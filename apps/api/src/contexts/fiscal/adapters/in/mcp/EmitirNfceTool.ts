import { Json, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { EmitNfce } from '@/contexts/fiscal/application/ports/in/EmitNfce'
import {
  fiscalResultToJson,
  parseAmbiente,
  parseDestinatario,
  parseItems,
} from '@/contexts/fiscal/adapters/in/mcp/fiscalInput'

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only
// the transport differs. Mutating -> requires confirmation (readOnly: false). Emits
// an NFC-e (modelo 65, varejo/consumidor) straight to SEFAZ. destinatário is
// OPTIONAL (anonymous consumer when omitted). NFC-e additionally needs the CSC +
// cscId configured; when the certificate, company config or CSC is missing the
// in-port fails with an actionable message, surfaced to Eric verbatim.
export const emitirNfceTool = (uc: EmitNfce): ToolDefinition => ({
  name: 'emitir_nfce',
  readOnly: false,
  description:
    'Emitir uma NFC-e (Nota Fiscal de Consumidor Eletrônica, modelo 65) direto na SEFAZ. Input: { destinatario?: { nome, cpfCnpj (só dígitos), ie?, email?, endereco? }, itens: [{ descricao, ncm, cfop, cst?, csosn?, origem?, unidade, quantidade, valorUnitario }], ambiente?: "homologacao" | "producao" }. destinatario é opcional (consumidor anônimo). Retorna { chave, protocolo, status, xml }. Requer o certificado A1, os dados fiscais da empresa e o CSC/cscId configurados em Settings.',
  async execute(input: Json) {
    if (!isJsonObject(input)) return fail('emitir_nfce: expected an object')
    const destinatario = parseDestinatario('emitir_nfce', input.destinatario, false)
    if (!destinatario.ok) return fail(destinatario.error)
    const items = parseItems('emitir_nfce', input.itens)
    if (!items.ok) return fail(items.error)

    const r = await uc.execute({
      destinatario: destinatario.value,
      items: items.value,
      ambiente: parseAmbiente(input.ambiente),
    })
    return r.ok ? ok(fiscalResultToJson(r.value)) : fail(r.error)
  },
})
