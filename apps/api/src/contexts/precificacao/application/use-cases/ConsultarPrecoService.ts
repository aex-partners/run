import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/precificacao/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/precificacao/application/ports/out/RecordStore'
import { ConsultarPreco, PrecoLinha } from '@/contexts/precificacao/application/ports/in/ConsultarPreco'
import { PrecificacaoError } from '@/contexts/precificacao/domain/PrecificacaoError'

const LIMITE = 500
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

export class ConsultarPrecoService implements ConsultarPreco {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}
  async execute(q: { skuId: string }): Promise<Result<{ skuId: string; custoBase: number; precos: PrecoLinha[] }>> {
    const precosId = await this.registry.entityIdBySlug('precos_de_venda')
    if (!precosId) return fail(PrecificacaoError.entidadeFaltando)
    const rows = await this.store.query(precosId, [{ field: 'sku', op: 'eq', value: q.skuId }], LIMITE)

    // `precos_de_venda` grava canal/condição como ID de registro relacionado. Ler só o id faria
    // o assistente exibir o UUID cru no lugar do nome ("lojista", "À vista") — a mesma classe de
    // bug que o smoke em produção pegou no estoque (depósito mostrando UUID). Resolve pra `nome`
    // aqui, na leitura, com o id como fallback defensivo (registro sumiu ou sem `nome`). Cache
    // por `execute()`: o mesmo canal/condição se repete em várias linhas do SKU.
    const nomeCache = new Map<string, string>()
    const nomeDe = async (id: string): Promise<string> => {
      if (id === '') return id
      if (!nomeCache.has(id)) {
        const r = await this.store.get(id)
        const nome = r && typeof r.data.nome === 'string' && r.data.nome.trim() !== '' ? r.data.nome : id
        nomeCache.set(id, nome)
      }
      return nomeCache.get(id)!
    }

    const precos: PrecoLinha[] = []
    for (const r of rows) {
      const canalId = String(r.data.canal ?? '')
      const condicaoId = String(r.data.condicao ?? '')
      precos.push({
        canalId, canal: await nomeDe(canalId),
        condicaoId, condicao: await nomeDe(condicaoId),
        preco: num(r.data.preco), lucroUsado: num(r.data.lucro_usado),
      })
    }
    const custoBase = rows.length ? num(rows[0]!.data.custo_base) : 0
    return ok({ skuId: q.skuId, custoBase, precos })
  }
}
