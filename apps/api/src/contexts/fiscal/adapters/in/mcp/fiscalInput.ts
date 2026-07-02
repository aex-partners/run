import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { Ambiente, isAmbiente } from '@/contexts/fiscal/domain/Ambiente'
import { Destinatario } from '@/contexts/fiscal/domain/Destinatario'
import { Endereco } from '@/contexts/fiscal/domain/Endereco'
import { FiscalItem, itemTotal } from '@/contexts/fiscal/domain/FiscalItem'
import { FiscalResult } from '@/contexts/fiscal/domain/FiscalResult'

// Shared parsing for the fiscal MCP tools (emitir_nfe / emitir_nfce). Turns the AI's
// loosely-typed JSON into validated domain commands, returning `Result` failures
// (never throwing) with actionable messages. Kept here so both tools stay thin and
// consistent.

const str = (v: Json | undefined): string | undefined => (typeof v === 'string' ? v : undefined)
const num = (v: Json | undefined): number | undefined => (typeof v === 'number' ? v : undefined)

// endereco is optional; returns ok(undefined) when absent, ok(Endereco) when valid.
export const parseEndereco = (tool: string, v: Json | undefined): Result<Endereco | undefined> => {
  if (v === undefined || v === null) return ok(undefined)
  if (!isJsonObject(v)) return fail(`${tool}: endereco must be an object`)
  const logradouro = str(v.logradouro)
  const numero = str(v.numero)
  const bairro = str(v.bairro)
  const municipio = str(v.municipio)
  const uf = str(v.uf)
  const cep = str(v.cep)
  if (!logradouro || !numero || !bairro || !municipio || !uf || !cep) {
    return fail(`${tool}: endereco requires logradouro, numero, bairro, municipio, uf, cep`)
  }
  return ok({
    logradouro,
    numero,
    bairro,
    municipio,
    codigoMunicipio: str(v.codigoMunicipio),
    uf,
    cep,
    complemento: str(v.complemento),
  })
}

export const parseDestinatario = (
  tool: string,
  v: Json | undefined,
  required: boolean,
): Result<Destinatario | undefined> => {
  if (v === undefined || v === null) {
    return required ? fail(`${tool}: destinatario is required`) : ok(undefined)
  }
  if (!isJsonObject(v)) return fail(`${tool}: destinatario must be an object`)
  const nome = str(v.nome)
  const cpfCnpj = str(v.cpfCnpj)
  if (!nome || !cpfCnpj) return fail(`${tool}: destinatario requires nome and cpfCnpj`)
  const endereco = parseEndereco(tool, v.endereco)
  if (!endereco.ok) return fail(endereco.error)
  return ok({ nome, cpfCnpj, ie: str(v.ie), email: str(v.email), endereco: endereco.value })
}

export const parseItems = (tool: string, v: Json | undefined): Result<FiscalItem[]> => {
  if (!Array.isArray(v) || v.length === 0) {
    return fail(`${tool}: itens must be a non-empty array`)
  }
  const items: FiscalItem[] = []
  for (let i = 0; i < v.length; i++) {
    const raw = v[i]
    if (raw === undefined || !isJsonObject(raw)) return fail(`${tool}: itens[${i}] must be an object`)
    const descricao = str(raw.descricao)
    const ncm = str(raw.ncm)
    const cfop = str(raw.cfop)
    const unidade = str(raw.unidade)
    const quantidade = num(raw.quantidade)
    const valorUnitario = num(raw.valorUnitario)
    if (!descricao || !ncm || !cfop || !unidade) {
      return fail(`${tool}: itens[${i}] requires descricao, ncm, cfop, unidade`)
    }
    if (quantidade === undefined || !(quantidade > 0)) {
      return fail(`${tool}: itens[${i}].quantidade must be a positive number`)
    }
    if (valorUnitario === undefined || !(valorUnitario > 0)) {
      return fail(`${tool}: itens[${i}].valorUnitario must be a positive number`)
    }
    items.push({
      descricao,
      ncm,
      cfop,
      cst: str(raw.cst),
      csosn: str(raw.csosn),
      origem: str(raw.origem) ?? '0', // 0 = nacional
      unidade,
      quantidade,
      valorUnitario,
      valorTotal: itemTotal(quantidade, valorUnitario),
    })
  }
  return ok(items)
}

// ambiente is optional; an invalid value is treated as absent (service defaults it).
export const parseAmbiente = (v: Json | undefined): Ambiente | undefined =>
  isAmbiente(v) ? v : undefined

// Serialize a FiscalResult for the model, dropping absent optionals.
export const fiscalResultToJson = (r: FiscalResult): JsonObject => {
  const out: JsonObject = {
    chave: r.chave,
    protocolo: r.protocolo,
    status: r.status,
    xml: r.xml,
  }
  if (r.danfeUrl) out.danfeUrl = r.danfeUrl
  if (r.danfeBase64) out.danfeBase64 = r.danfeBase64
  return out
}
