import { Json, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { EmitNfe } from '@/contexts/fiscal/application/ports/in/EmitNfe'
import {
  fiscalResultToJson,
  parseAmbiente,
  parseDestinatario,
  parseItems,
} from '@/contexts/fiscal/adapters/in/mcp/fiscalInput'

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only
// the transport differs. Mutating -> requires confirmation (readOnly: false). Emits
// an NF-e (modelo 55) straight to SEFAZ. The emitente comes from company settings,
// so the tool only carries the destinatário + itens. When the certificate or the
// company config is missing the in-port fails with an actionable message, surfaced
// to Eric verbatim.
export const emitirNfeTool = (uc: EmitNfe): ToolDefinition => ({
  name: 'emitir_nfe',
  readOnly: false,
  description:
    'Emitir uma NF-e (Nota Fiscal Eletrônica, modelo 55) direto na SEFAZ. Input: { destinatario: { nome, cpfCnpj (só dígitos), ie?, email?, endereco?: { logradouro, numero, bairro, municipio, codigoMunicipio?, uf, cep, complemento? } }, itens: [{ descricao, ncm, cfop, cst?, csosn?, origem?, unidade, quantidade, valorUnitario }], ambiente?: "homologacao" | "producao" }. Retorna { chave, protocolo, status, xml }. Requer o certificado A1 e os dados fiscais da empresa configurados em Settings.',
  async execute(input: Json) {
    if (!isJsonObject(input)) return fail('emitir_nfe: expected an object')
    const destinatario = parseDestinatario('emitir_nfe', input.destinatario, true)
    if (!destinatario.ok) return fail(destinatario.error)
    // required:true guarantees a value, but narrow explicitly (no non-null assertion).
    if (!destinatario.value) return fail('emitir_nfe: destinatario is required')
    const items = parseItems('emitir_nfe', input.itens)
    if (!items.ok) return fail(items.error)

    const r = await uc.execute({
      destinatario: destinatario.value,
      items: items.value,
      ambiente: parseAmbiente(input.ambiente),
    })
    return r.ok ? ok(fiscalResultToJson(r.value)) : fail(r.error)
  },
})
