import { Json, JsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { ListBlingResource } from '@/contexts/bling/application/ports/in/ListBlingResource'
import { parseBlingInput } from '@/contexts/bling/adapters/in/mcp/blingInput'

// Driving adapter for the AI. Read-only -> auto-executes (no confirmation). Lists
// pedidos de venda from the connected Bling account. Requires Bling to be
// connected in Settings; the use-case surfaces that failure verbatim.
export const listPedidosTool = (uc: ListBlingResource): ToolDefinition => ({
  name: 'bling_listar_pedidos',
  readOnly: true,
  description:
    'Lista pedidos de venda do Bling (ERP). Input: { pagina?: number, limite?: number, pesquisa?: string }. Retorna { items: [...] } com os pedidos. Requer o Bling conectado em Settings.',
  async execute(input: Json) {
    const parsed = parseBlingInput(input)
    if (!parsed) return fail('bling_listar_pedidos: expected an object')
    const r = await uc.execute({
      resource: 'pedidos',
      pagina: parsed.pagina,
      limite: parsed.limite,
      pesquisa: parsed.pesquisa,
    })
    return r.ok ? ok({ items: r.value.items } as JsonObject) : fail(r.error)
  },
})
