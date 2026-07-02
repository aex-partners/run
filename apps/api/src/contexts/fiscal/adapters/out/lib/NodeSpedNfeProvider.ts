import { Tools, Make, cUF2UF, UF2cUF } from 'node-sped-nfe'
import { ok, fail, Result } from '@/shared/kernel/Result'
import { FiscalProvider } from '@/contexts/fiscal/application/ports/out/FiscalProvider'
import { Certificate } from '@/contexts/fiscal/domain/credential'
import { FiscalDocument } from '@/contexts/fiscal/domain/FiscalDocument'
import { FiscalResult, FiscalStatus } from '@/contexts/fiscal/domain/FiscalResult'
import { FiscalError } from '@/contexts/fiscal/domain/FiscalError'
import { modelCode } from '@/contexts/fiscal/domain/FiscalModel'
import { tpAmb } from '@/contexts/fiscal/domain/Ambiente'
import { Emitente, usesSimplesNacional } from '@/contexts/fiscal/domain/Emitente'
import { FiscalItem } from '@/contexts/fiscal/domain/FiscalItem'

// ============================================================================
// ACL adapter for node-sped-nfe (direct-to-SEFAZ emission, NO gateway).
//
// Real node-sped-nfe API mapped here (class + method):
//   - Tools(config, { pfx, senha })  — SEFAZ transport + signing session.
//       .xmlSign(xml, { tag: 'infNFe' })                        -> signed XML
//       .sefazEnviaLote(signedXml, { idLote, indSinc, compactar}) -> SOAP reply XML
//       .consultarNFe(chNFe)                                     -> SOAP reply XML
//       .sefazEvento({ chNFe, tpEvento, nProt, xJust, nSeqEvento }) -> reply XML
//       .xml2json(xml)                                           -> parsed object
//   - Make()                          — builds the modelo 55/65 NF-e body:
//       tagInfNFe, tagIde, tagEmit, tagEnderEmit, tagDest, tagEnderDest,
//       tagProd (async, array), tagProdICMSSN | tagProdICMS, tagProdPIS,
//       tagProdCOFINS, tagTotal, tagDetPag, tagInfRespTec, xml() -> NF-e XML
//   - UF2cUF / cUF2UF                 — UF <-> IBGE numeric code maps.
//
// The A1 certificate arrives as base64 (.pfx) + password; node-sped-nfe hands the
// pfx to `pem.readPkcs12`, which shells out to the openssl CLI (installed in the
// Dockerfile deps stage). All XML/SOAP/network faults are caught and returned as
// `Result` failures — this adapter NEVER throws across the port.
//
// Best-effort mapping assumptions (no live certificate available to validate; each
// is a coherent SEFAZ default, flagged so a fiscal specialist can tune per company):
//   * ide: cNF random, serie 1, nNF derived from the clock, tpNF=1 (saída),
//     idDest=1 (interna), tpEmis=1, finNFe=1, procEmi=0; NFC-e sets
//     tpImp=4/indFinal=1/indPres=1, NF-e sets tpImp=1/indFinal=0/indPres=0.
//   * cDV + chave are computed by Make.xml().
//   * Taxes: Simples Nacional -> CSOSN (ICMSSN, default 102); regime normal -> CST
//     (ICMS00, zeroed BC/aliquota). PIS/COFINS default to CST 07 (não tributada).
//   * Payment: a single detPag (tPag 01 = dinheiro) for the document total.
//   * infRespTec uses the emitente CNPJ/razão as the technical contact.
//   * getStatus/cancel derive the UF/CNPJ from the 44-digit chave; ambiente cannot
//     be read from the chave so it defaults to homologação (2).
//   * result.xml is the signed NF-e; assembling the full nfeProc (NFe + protNFe)
//     and rendering a DANFE PDF are left for a follow-up (danfeUrl/Base64 unset).
// ============================================================================

// -- narrowing helpers (keep parsing `any`-free) -----------------------------
const asStr = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return undefined
}

// Depth-first search for the first occurrence of `key` in a parsed-XML tree
// (objects and arrays). SEFAZ nests protNFe/infProt at varying depths and it may be
// an array, so a structural search is more robust than a fixed path.
const deepFind = (node: unknown, key: string): unknown => {
  if (node === null || typeof node !== 'object') return undefined
  if (Array.isArray(node)) {
    for (const el of node) {
      const found = deepFind(el, key)
      if (found !== undefined) return found
    }
    return undefined
  }
  const rec = node as Record<string, unknown>
  if (key in rec) return rec[key]
  for (const v of Object.values(rec)) {
    const found = deepFind(v, key)
    if (found !== undefined) return found
  }
  return undefined
}

// Fold SEFAZ's cStat vocabulary onto the domain's small status set.
const mapStatus = (cStat: string | undefined, hint?: FiscalStatus): FiscalStatus => {
  switch (cStat) {
    case '100': // Autorizado o uso da NF-e
    case '150': // Autorizado fora de prazo
      return 'autorizado'
    case '101': // Cancelamento homologado
    case '135': // Evento registrado e vinculado
    case '151':
    case '155':
      return 'cancelado'
    case undefined:
    case '':
      return hint ?? 'pendente'
    default:
      // 103/104/105 are lote-processing acks (fall back to the caller hint), any
      // other code is a rejection/denial.
      if (cStat === '103' || cStat === '104' || cStat === '105') return hint ?? 'pendente'
      return 'rejeitado'
  }
}

// Cast helper for the UF<->code maps (the lib types them as `any`).
const ufToCode = (uf: string): number => Number((UF2cUF as Record<string, string | number>)[uf] ?? 0)
const codeToUf = (code: string): string => String((cUF2UF as Record<string, string>)[code] ?? '')

// The lib feeds `pfx` straight to pem.readPkcs12, which accepts a Buffer even though
// the published type says `string`; decode the base64 and cast to the declared type.
type CertArg = { pfx: string; senha: string }
const certArg = (cert: Certificate): CertArg =>
  ({ pfx: Buffer.from(cert.pfx, 'base64'), senha: cert.password } as unknown as CertArg)

export class NodeSpedNfeProvider implements FiscalProvider {
  async emit(doc: FiscalDocument, cert: Certificate): Promise<Result<FiscalResult>> {
    try {
      const emit = doc.emitente
      const tools = new Tools(
        {
          mod: modelCode(doc.model),
          xmllint: 'xmllint',
          UF: emit.uf,
          tpAmb: tpAmb(doc.ambiente),
          CSC: emit.csc ?? '',
          CSCid: emit.cscId ?? '',
          versao: '4.00',
          timeout: 30,
          openssl: null,
          CPF: '',
          CNPJ: emit.cnpj,
        },
        certArg(cert),
      )

      const nfeXml = await this.buildDocument(doc)
      const signed = await tools.xmlSign(nfeXml, { tag: 'infNFe' })
      // indSinc: 1 = synchronous, so the protocol comes back in the same reply. The
      // lib types the options as narrow literals ({indSinc?: 0}) but accepts any at
      // runtime, so we cast to the declared parameter type.
      const loteOpts = { idLote: 1, indSinc: 1, compactar: false } as unknown as Parameters<
        Tools['sefazEnviaLote']
      >[1]
      const reply = await tools.sefazEnviaLote(signed, loteOpts)
      const parsed = await tools.xml2json(reply)
      return ok(this.mapReply(parsed, signed))
    } catch (e) {
      return fail(FiscalError.provider(errorMessage(e)))
    }
  }

  async getStatus(chave: string, cert: Certificate): Promise<Result<FiscalResult>> {
    try {
      const tools = this.toolsForChave(chave, cert)
      const reply = await tools.consultarNFe(chave)
      const parsed = await tools.xml2json(reply)
      return ok(this.mapReply(parsed, reply, chave))
    } catch (e) {
      return fail(FiscalError.provider(errorMessage(e)))
    }
  }

  async cancel(chave: string, reason: string, cert: Certificate): Promise<Result<FiscalResult>> {
    try {
      const tools = this.toolsForChave(chave, cert)
      // Cancellation (evento 110111) requires the authorization protocol; fetch it
      // from a situation query first.
      const consulta = await tools.xml2json(await tools.consultarNFe(chave))
      const nProt = asStr(deepFind(consulta, 'nProt')) ?? ''
      const reply = await tools.sefazEvento({
        chNFe: chave,
        tpEvento: '110111',
        nProt,
        xJust: reason,
        nSeqEvento: 1,
      })
      const parsed = await tools.xml2json(reply)
      return ok(this.mapReply(parsed, reply, chave, 'cancelado'))
    } catch (e) {
      return fail(FiscalError.provider(errorMessage(e)))
    }
  }

  // -- Tools for a chave-only operation (status/cancel) ------------------------
  private toolsForChave(chave: string, cert: Certificate): Tools {
    const cUF = chave.slice(0, 2)
    const cnpj = chave.slice(6, 20)
    const mod = chave.slice(20, 22)
    return new Tools(
      {
        mod,
        xmllint: 'xmllint',
        UF: codeToUf(cUF),
        tpAmb: 2, // chave carries no environment; default to homologação.
        CSC: '',
        CSCid: '',
        versao: '4.00',
        timeout: 30,
        openssl: null,
        CPF: '',
        CNPJ: cnpj,
      },
      certArg(cert),
    )
  }

  // -- Make: normalized FiscalDocument -> node-sped-nfe modelo 55/65 body ------
  private async buildDocument(doc: FiscalDocument): Promise<string> {
    const make = new Make()
    const emit = doc.emitente
    const isNfce = doc.model === 'nfce'
    const amb = tpAmb(doc.ambiente)

    make.tagInfNFe({ versao: '4.00' })
    make.tagIde({
      cUF: ufToCode(emit.uf),
      cNF: randomCNF(),
      natOp: 'VENDA',
      mod: modelCode(doc.model),
      serie: 1,
      nNF: sequentialNNF(),
      dhEmi: make.formatData(),
      tpNF: 1, // 1 = saída
      idDest: 1, // 1 = operação interna (assumption)
      cMunFG: emit.endereco.codigoMunicipio ?? '',
      tpImp: isNfce ? 4 : 1, // 4 = DANFE NFC-e, 1 = DANFE retrato
      tpEmis: 1, // emissão normal
      cDV: 0, // recomputed by Make.xml()
      tpAmb: amb,
      finNFe: 1, // NF-e normal
      indFinal: isNfce ? 1 : 0, // consumidor final
      indPres: isNfce ? 1 : 0, // 1 = presencial (NFC-e)
      procEmi: 0,
      verProc: 'run-hex-fiscal/1.0',
    })

    make.tagEmit({
      CNPJ: emit.cnpj,
      xNome: emit.razaoSocial,
      xFant: emit.razaoSocial, // presence initialises enderEmit inside Make
      IE: emit.ie,
      CRT: emit.regimeTributario,
    })
    const end = emit.endereco
    make.tagEnderEmit({
      xLgr: end.logradouro,
      nro: end.numero,
      xBairro: end.bairro,
      cMun: end.codigoMunicipio ?? '',
      xMun: end.municipio,
      UF: end.uf,
      CEP: end.cep,
      cPais: '1058',
      xPais: 'BRASIL',
      ...(end.complemento ? { xCpl: end.complemento } : {}),
    })

    // Destinatário: omitted entirely for an anonymous NFC-e (empty cpfCnpj).
    const dest = doc.destinatario
    const docDigits = dest.cpfCnpj.replace(/\D/g, '')
    if (docDigits.length > 0) {
      make.tagDest({
        ...(docDigits.length === 14 ? { CNPJ: docDigits } : { CPF: docDigits }),
        xNome: dest.nome,
        indIEDest: dest.ie ? 1 : 9, // 1 = contribuinte ICMS, 9 = não contribuinte
        ...(dest.ie ? { IE: dest.ie } : {}),
        ...(dest.email ? { email: dest.email } : {}),
      })
      // enderDest applies only to NF-e (Make no-ops it for modelo 65).
      if (!isNfce && dest.endereco) {
        const de = dest.endereco
        make.tagEnderDest({
          xLgr: de.logradouro,
          nro: de.numero,
          xBairro: de.bairro,
          cMun: de.codigoMunicipio ?? '',
          xMun: de.municipio,
          UF: de.uf,
          CEP: de.cep,
          cPais: '1058',
          xPais: 'BRASIL',
          ...(de.complemento ? { xCpl: de.complemento } : {}),
        })
      }
    }

    // Products (Make.tagProd is async and takes the whole array).
    await make.tagProd(doc.items.map((it, i) => this.prod(it, i)))

    // Per-item taxes.
    const simples = usesSimplesNacional(emit.regimeTributario)
    doc.items.forEach((it, i) => {
      if (simples) {
        make.tagProdICMSSN(i, { orig: it.origem, CSOSN: it.csosn ?? '102' })
      } else {
        make.tagProdICMS(i, {
          orig: it.origem,
          CST: it.cst ?? '00',
          modBC: 3,
          vBC: '0.00',
          pICMS: '0.00',
          vICMS: '0.00',
        })
      }
      make.tagProdPIS(i, { CST: '07' }) // 07 = operação sem incidência
      make.tagProdCOFINS(i, { CST: '07' })
    })

    // Empty overrides object: Make computes ICMSTot from the accumulated line values.
    make.tagTotal({})

    // Payment (mandatory in 4.00). Single cash line for the document total.
    const total = doc.items.reduce((acc, it) => acc + it.valorTotal, 0).toFixed(2)
    make.tagDetPag([{ tPag: '01', vPag: total }])

    // Responsável técnico (mandatory since 4.00) — reuse the emitente identity.
    make.tagInfRespTec({
      CNPJ: emit.cnpj,
      xContato: emit.razaoSocial || 'Responsavel',
      email: dest.email ?? 'contato@example.com',
      fone: '0000000000',
    })

    return make.xml()
  }

  private prod(it: FiscalItem, index: number): Record<string, unknown> {
    return {
      cProd: String(index + 1),
      cEAN: 'SEM GTIN',
      xProd: it.descricao,
      NCM: it.ncm,
      CFOP: it.cfop,
      uCom: it.unidade,
      qCom: it.quantidade,
      vUnCom: it.valorUnitario,
      vProd: it.valorTotal,
      cEANTrib: 'SEM GTIN',
      uTrib: it.unidade,
      qTrib: it.quantidade,
      vUnTrib: it.valorUnitario,
      indTot: 1,
    }
  }

  // -- reply (SEFAZ XML -> FiscalResult) --------------------------------------
  private mapReply(
    parsed: unknown,
    xml: string,
    fallbackChave?: string,
    hint?: FiscalStatus,
  ): FiscalResult {
    // Prefer the protocol block; fall back to the top-level lote/consult reply.
    const infProt = deepFind(parsed, 'infProt')
    const scope = infProt ?? parsed
    const chave =
      asStr(deepFind(scope, 'chNFe')) ??
      fallbackChave ??
      chaveFromXml(xml) ??
      ''
    return {
      chave,
      protocolo: asStr(deepFind(scope, 'nProt')) ?? '',
      status: mapStatus(asStr(deepFind(scope, 'cStat')), hint),
      xml,
    }
  }
}

// -- module-level pure helpers -------------------------------------------------
const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)

// Random 8-digit cNF (SEFAZ forbids it from equalling nNF; the odds are negligible
// and Make recomputes the check digit regardless).
const randomCNF = (): string => String(Math.floor(Math.random() * 1e8)).padStart(8, '0')

// A monotonic-ish nNF (max 9 digits) from the clock. A production deployment should
// swap this for a per-series counter; without persistence the timestamp keeps
// successive emissions distinct.
const sequentialNNF = (): number => Math.floor(Date.now() / 1000) % 1_000_000_000

// Extract the 44-digit chave from a signed NF-e XML (Id="NFe<44>").
const chaveFromXml = (xml: string): string | undefined => {
  const m = /Id="NFe(\d{44})"/.exec(xml)
  return m ? m[1] : undefined
}
