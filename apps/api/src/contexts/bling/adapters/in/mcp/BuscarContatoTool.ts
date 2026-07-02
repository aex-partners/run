import { Json, JsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { ListBlingResource } from '@/contexts/bling/application/ports/in/ListBlingResource'
import { GetBlingRecord } from '@/contexts/bling/application/ports/in/GetBlingRecord'
import { parseBlingInput } from '@/contexts/bling/adapters/in/mcp/blingInput'

// Driving adapter for the AI. Read-only -> auto-executes (no confirmation). Finds
// contatos in the connected Bling account: when `id` is given it fetches that one
// contato, otherwise it lists contatos (optionally filtered by `pesquisa`).
// Requires Bling to be connected in Settings; failures surface verbatim.
export const buscarContatoTool = (
  list: ListBlingResource,
  get: GetBlingRecord,
): ToolDefinition => ({
  name: 'bling_buscar_contato',
  readOnly: true,
  description:
    'Busca contatos (clientes/fornecedores) no Bling (ERP). Input: { id?: string, pagina?: number, limite?: number, pesquisa?: string }. Com `id`, retorna { contato } daquele contato (ou null). Sem `id`, retorna { items: [...] } filtrados por `pesquisa`. Requer o Bling conectado em Settings.',
  async execute(input: Json) {
    const parsed = parseBlingInput(input)
    if (!parsed) return fail('bling_buscar_contato: expected an object')

    if (parsed.id) {
      const r = await get.execute({ resource: 'contatos', id: parsed.id })
      return r.ok ? ok({ contato: r.value } as JsonObject) : fail(r.error)
    }

    const r = await list.execute({
      resource: 'contatos',
      pagina: parsed.pagina,
      limite: parsed.limite,
      pesquisa: parsed.pesquisa,
    })
    return r.ok ? ok({ items: r.value.items } as JsonObject) : fail(r.error)
  },
})
