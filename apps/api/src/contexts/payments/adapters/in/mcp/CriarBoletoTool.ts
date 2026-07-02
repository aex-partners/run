import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { CreateBoleto } from '@/contexts/payments/application/ports/in/CreateBoleto'
import { Boleto } from '@/contexts/payments/domain/Boleto'
import { Pagador, PagadorEndereco } from '@/contexts/payments/domain/Pagador'
import { Money } from '@/contexts/payments/domain/Money'

const str = (v: Json | undefined): string | undefined => (typeof v === 'string' ? v : undefined)

// Parse the optional pagador address. Returns ok(undefined) when absent, a failure
// when present but incomplete. All six fields are required when an address is given.
const parseEndereco = (v: Json | undefined): { ok: true; value: PagadorEndereco | undefined } | { ok: false; error: string } => {
  if (v === undefined || v === null) return { ok: true, value: undefined }
  if (!isJsonObject(v)) return { ok: false, error: 'criar_boleto: pagador.endereco must be an object' }
  const logradouro = str(v.logradouro)
  const numero = str(v.numero)
  const bairro = str(v.bairro)
  const cidade = str(v.cidade)
  const uf = str(v.uf)
  const cep = str(v.cep)
  if (!logradouro || !numero || !bairro || !cidade || !uf || !cep) {
    return { ok: false, error: 'criar_boleto: pagador.endereco requires logradouro, numero, bairro, cidade, uf, cep' }
  }
  return { ok: true, value: { logradouro, numero, bairro, cidade, uf, cep } }
}

// Serialize a Boleto to a JSON object for the model, dropping absent optionals (the
// Json algebra has no `undefined`). `valor` is the human-facing BRL string.
const boletoToJson = (b: Boleto): JsonObject => {
  const out: JsonObject = {
    nossoNumero: b.nossoNumero,
    linhaDigitavel: b.linhaDigitavel,
    codigoBarras: b.codigoBarras,
    valor: Money.formatBRL(b.valorCents),
    valorCents: b.valorCents,
    vencimento: b.vencimento,
    status: b.status,
  }
  if (b.pixQrCode) out.pixQrCode = b.pixQrCode
  if (b.txid) out.txid = b.txid
  if (b.pdfUrl) out.pdfUrl = b.pdfUrl
  return out
}

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only the
// transport differs. Mutating -> requires confirmation (readOnly: false). Registers a
// boleto (hybrid boleto+PIX) at Sicredi. The beneficiário comes from company
// settings, so the tool only carries the pagador + valor + vencimento. Amount arrives
// in reais (BRL) and is converted to centavos. When Sicredi is not connected or the
// beneficiário config is incomplete the in-port fails with an actionable message,
// surfaced to Eric verbatim.
export const criarBoletoTool = (uc: CreateBoleto): ToolDefinition => ({
  name: 'criar_boleto',
  readOnly: false,
  description:
    'Registrar um boleto (híbrido boleto+PIX) via Sicredi. Input: { pagador: { nome: string, cpfCnpj: string (só dígitos), endereco?: { logradouro, numero, bairro, cidade, uf, cep } }, valor: number (em BRL, ex.: 149.90), vencimento: string (YYYY-MM-DD), seuNumero?: string, mensagem?: string }. Retorna { nossoNumero, linhaDigitavel, codigoBarras, pixQrCode?, valor, vencimento, status }. Requer as credenciais Sicredi e os dados do beneficiário configurados em Settings.',
  async execute(input: Json) {
    if (!isJsonObject(input)) return fail('criar_boleto: expected an object')
    const { pagador, valor, vencimento, seuNumero, mensagem } = input

    if (pagador === undefined || !isJsonObject(pagador)) {
      return fail('criar_boleto: expected pagador { nome, cpfCnpj, endereco? }')
    }
    const nome = str(pagador.nome)
    const cpfCnpj = str(pagador.cpfCnpj)
    if (!nome || !cpfCnpj) return fail('criar_boleto: pagador.nome and pagador.cpfCnpj are required strings')
    const endereco = parseEndereco(pagador.endereco)
    if (!endereco.ok) return fail(endereco.error)

    if (typeof valor !== 'number' || !(valor > 0)) return fail('criar_boleto: valor must be a positive number (BRL)')
    if (typeof vencimento !== 'string' || vencimento.length === 0) {
      return fail('criar_boleto: vencimento must be a date string (YYYY-MM-DD)')
    }

    const pagadorCmd: Pagador = { nome, cpfCnpj, endereco: endereco.value }
    const r = await uc.execute({
      pagador: pagadorCmd,
      valorCents: Money.reaisToCents(valor),
      vencimento,
      seuNumero: str(seuNumero),
      mensagem: str(mensagem),
    })
    return r.ok ? ok(boletoToJson(r.value)) : fail(r.error)
  },
})
