import { ok, fail, Result } from '@/shared/kernel/Result'
import {
  BoletoAuth,
  BoletoProvider,
  CreateBoletoInput,
} from '@/contexts/payments/application/ports/out/BoletoProvider'
import { Boleto } from '@/contexts/payments/domain/Boleto'
import { BoletoStatus } from '@/contexts/payments/domain/BoletoStatus'
import { Pagador } from '@/contexts/payments/domain/Pagador'
import { SicrediCredential } from '@/contexts/payments/domain/sicrediCredential'
import { Money } from '@/contexts/payments/domain/Money'
import { PaymentError } from '@/contexts/payments/domain/PaymentError'

// ============================================================================
// ACL adapter for the Sicredi Cobrança API (REST + OAuth2, no gateway). Base URL
// comes from SICREDI_BASE, defaulting to the parceiro host; point it at the sandbox
// host to test. Every network/HTTP fault is caught and returned as a `Result`
// failure — this adapter NEVER throws across the port.
//
// Best-effort mapping assumptions (NO live credential available to validate; each is
// a coherent reading of the documented Sicredi Cobrança Boleto API, FLAGGED so an
// integrator can tune once real credentials exist — same approach the fiscal adapter
// took):
//   * TOKEN: POST {base}/auth/openapi/token, form-urlencoded. Sicredi's OAuth2 has
//     been documented with two shapes; the adapter uses whichever the credential bag
//     satisfies:
//       - password flow    : grant_type=password + username/password (+ scope)
//       - client_credentials: grant_type=client_credentials + client_id/client_secret
//     The `x-api-key` header + `context: COBRANCA` header are sent when an apiKey is
//     present (Sicredi gates the API behind an api key). Response: { access_token }.
//     A production impl would cache the token until `expires_in`; here it is fetched
//     per call to stay stateless.
//   * CREATE: POST {base}/cobranca/boleto/v1/boletos with the beneficiário in headers
//     (cooperativa / posto / codigoBeneficiario) + a JSON body carrying pagador,
//     valor (in reais), dataVencimento, seuNumero. `tipoCobranca: HIBRIDO` requests a
//     boleto + PIX (the response then carries the QR + txid).
//   * GET: GET {base}/cobranca/boleto/v1/boletos/{nossoNumero}?codigoBeneficiario=...
//   * RESPONSE field names (nossoNumero, linhaDigitavel, codigoBarras, txid, qrCode,
//     pdf/urlPdf, situacao) are mapped defensively — unknown keys fall back to sane
//     defaults rather than crashing.
// ============================================================================
const DEFAULT_BASE = 'https://api-parceiro.sicredi.com.br'
const TOKEN_PATH = '/auth/openapi/token'
const BOLETO_PATH = '/cobranca/boleto/v1/boletos'

// -- narrowing helpers (keep parsing `any`-free) -----------------------------
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const asString = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return undefined
}
const asNumber = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

// Fold Sicredi's raw situação vocabulary onto the domain's small set. Assumption:
// the API reports a `situacao` string; the values below are the documented ones.
const mapStatus = (raw: string | undefined): BoletoStatus => {
  switch ((raw ?? '').toUpperCase()) {
    case 'LIQUIDADO':
    case 'PAGO':
      return 'paid'
    case 'BAIXADO':
    case 'CANCELADO':
      return 'canceled'
    case 'VENCIDO':
    case 'EXPIRADO':
      return 'expired'
    case 'REJEITADO':
    case 'ERRO':
      return 'failed'
    default:
      // EMITIDO / REGISTRADO / EM_CARTEIRA / unknown -> registered.
      return 'registered'
  }
}

// PESSOA_FISICA for an 11-digit CPF, PESSOA_JURIDICA for a 14-digit CNPJ.
const tipoPessoa = (cpfCnpj: string): string =>
  cpfCnpj.replace(/\D/g, '').length > 11 ? 'PESSOA_JURIDICA' : 'PESSOA_FISICA'

export class SicrediBoletoProvider implements BoletoProvider {
  // App-level credentials belong to AEX Run (the software registered as a Sicredi
  // parceiro), so they come from PLATFORM env — never the per-tenant credential
  // store. The per-tenant beneficiário auth (username/password/x-api-key) rides in
  // `auth.credential`.
  constructor(
    private readonly base: string = process.env.SICREDI_BASE ?? DEFAULT_BASE,
    private readonly appClientId: string = process.env.SICREDI_CLIENT_ID ?? '',
    private readonly appClientSecret: string = process.env.SICREDI_CLIENT_SECRET ?? '',
  ) {}

  async createBoleto(auth: BoletoAuth, input: CreateBoletoInput): Promise<Result<Boleto>> {
    const token = await this.token(auth.credential)
    if (!token.ok) return token

    const body: Record<string, unknown> = {
      // HIBRIDO = boleto + PIX (drop to "NORMAL" for a boleto-only slip).
      tipoCobranca: 'HIBRIDO',
      codigoBeneficiario: auth.beneficiario.codigoBeneficiario,
      // especieDocumento assumption: DMI (duplicata mercantil por indicação), the
      // common default for a generic charge.
      especieDocumento: 'DUPLICATA_MERCANTIL_INDICACAO',
      seuNumero: input.seuNumero ?? `boleto-${Date.now()}`,
      dataVencimento: input.vencimento,
      // Sicredi expects the amount in reais (decimal), not centavos.
      valor: Money.centsToReais(input.valorCents),
      pagador: this.pagadorBody(input.pagador),
    }
    if (input.mensagem) body.mensagens = [input.mensagem]

    const res = await this.request(token.value, auth, 'POST', BOLETO_PATH, body)
    if (!res.ok) return res
    return ok(this.mapBoleto(res.value, input))
  }

  async getBoleto(auth: BoletoAuth, nossoNumero: string): Promise<Result<Boleto>> {
    const token = await this.token(auth.credential)
    if (!token.ok) return token

    const path = `${BOLETO_PATH}/${encodeURIComponent(nossoNumero)}?codigoBeneficiario=${encodeURIComponent(
      auth.beneficiario.codigoBeneficiario,
    )}`
    const res = await this.request(token.value, auth, 'GET', path)
    if (!res.ok) return res
    return ok(this.mapBoleto(res.value))
  }

  // -- OAuth2 token exchange ---------------------------------------------------
  // App identity (client_id/client_secret, AEX Run's parceiro app) comes from env;
  // the beneficiário account authenticates with its own username (Beneficiário +
  // Cooperativa) + password (Código de Acesso) and x-api-key (Chave de Acesso).
  private async token(credential: SicrediCredential): Promise<Result<string>> {
    if (!this.appClientId || !this.appClientSecret) {
      return fail(PaymentError.sicrediProvider('app Sicredi não configurado no servidor (defina SICREDI_CLIENT_ID e SICREDI_CLIENT_SECRET)'))
    }
    const form = new URLSearchParams()
    form.set('client_id', this.appClientId)
    form.set('client_secret', this.appClientSecret)
    form.set('scope', 'cobranca')
    // Beneficiário password grant when the account provided username + Código de
    // Acesso; otherwise a client_credentials grant carrying only the app identity
    // + the account's Chave de Acesso (x-api-key header, set below).
    if (credential.username && credential.password) {
      form.set('grant_type', 'password')
      form.set('username', credential.username)
      form.set('password', credential.password)
    } else {
      form.set('grant_type', 'client_credentials')
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      context: 'COBRANCA',
    }
    if (credential.apiKey) headers['x-api-key'] = credential.apiKey

    try {
      const res = await fetch(`${this.base}${TOKEN_PATH}`, { method: 'POST', headers, body: form.toString() })
      const json = await this.readJson(res)
      if (!res.ok) return fail(PaymentError.sicrediProvider(`token ${res.status} ${this.readError(json)}`))
      const accessToken = isRecord(json) ? asString(json.access_token) : undefined
      if (!accessToken) return fail(PaymentError.sicrediProvider('token endpoint did not return access_token'))
      return ok(accessToken)
    } catch (e) {
      return fail(PaymentError.sicrediProvider(e instanceof Error ? e.message : String(e)))
    }
  }

  // -- payload -----------------------------------------------------------------
  private pagadorBody(p: Pagador): Record<string, unknown> {
    const out: Record<string, unknown> = {
      tipoPessoa: tipoPessoa(p.cpfCnpj),
      documento: p.cpfCnpj.replace(/\D/g, ''),
      nome: p.nome,
    }
    if (p.endereco) {
      out.endereco = `${p.endereco.logradouro}, ${p.endereco.numero}`
      out.bairro = p.endereco.bairro
      out.cidade = p.endereco.cidade
      out.uf = p.endereco.uf
      out.cep = p.endereco.cep.replace(/\D/g, '')
    }
    return out
  }

  // -- response mapping --------------------------------------------------------
  // `fallback` (the create input) backfills fields the create response may omit
  // (valor / vencimento / pagador), so the returned Boleto is always complete.
  private mapBoleto(root: Record<string, unknown>, fallback?: CreateBoletoInput): Boleto {
    const valorReais = asNumber(root.valor)
    const qrCode = asString(root.qrCode) ?? asString(root.pixCopiaECola) ?? asString(root.emv)
    return {
      nossoNumero: asString(root.nossoNumero) ?? asString(root.codigo) ?? '',
      linhaDigitavel: asString(root.linhaDigitavel) ?? '',
      codigoBarras: asString(root.codigoBarras) ?? asString(root.codigoDeBarras) ?? '',
      valorCents: valorReais !== undefined ? Money.reaisToCents(valorReais) : fallback?.valorCents ?? 0,
      vencimento: asString(root.dataVencimento) ?? fallback?.vencimento ?? '',
      status: mapStatus(asString(root.situacao) ?? asString(root.status)),
      pagador: fallback?.pagador ?? this.mapPagador(root),
      pixQrCode: qrCode,
      txid: asString(root.txid),
      pdfUrl: asString(root.urlPdf) ?? asString(root.pdf) ?? asString(root.linkPdf),
    }
  }

  private mapPagador(root: Record<string, unknown>): Pagador {
    const p = isRecord(root.pagador) ? root.pagador : {}
    return {
      nome: asString(p.nome) ?? '',
      cpfCnpj: asString(p.documento) ?? asString(p.cpfCnpj) ?? '',
    }
  }

  // -- transport ---------------------------------------------------------------
  private async request(
    token: string,
    auth: BoletoAuth,
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Result<Record<string, unknown>>> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      context: 'COBRANCA',
      // Beneficiário identity Sicredi expects on cobrança calls (assumption:
      // cooperativa + posto ride as headers; codigoBeneficiario also in the body).
      cooperativa: auth.beneficiario.cooperativa,
      posto: auth.beneficiario.agencia,
    }
    if (auth.credential.apiKey) headers['x-api-key'] = auth.credential.apiKey
    if (body) headers['Content-Type'] = 'application/json'

    try {
      const res = await fetch(`${this.base}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
      const json = await this.readJson(res)
      if (!res.ok) return fail(PaymentError.sicrediProvider(`${res.status} ${this.readError(json)}`))
      return ok(isRecord(json) ? json : {})
    } catch (e) {
      return fail(PaymentError.sicrediProvider(e instanceof Error ? e.message : String(e)))
    }
  }

  private async readJson(res: Response): Promise<unknown> {
    const text = await res.text()
    if (!text) return {}
    try {
      return JSON.parse(text)
    } catch {
      // Non-JSON error bodies (HTML gateway pages, plain text) surface as the text.
      return { message: text }
    }
  }

  // Sicredi error payloads vary; probe the common shapes ({ message }, { error },
  // { error_description }, { mensagem }, or an array of { mensagem }).
  private readError(json: unknown): string {
    if (!isRecord(json)) return ''
    const direct =
      asString(json.message) ??
      asString(json.error_description) ??
      asString(json.mensagem) ??
      asString(json.error)
    if (direct) return direct
    if (Array.isArray(json.erros)) {
      const parts = json.erros
        .map((e) => (isRecord(e) ? asString(e.mensagem) ?? asString(e.message) : undefined))
        .filter((s): s is string => !!s)
      if (parts.length > 0) return parts.join('; ')
    }
    return ''
  }
}
