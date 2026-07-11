import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/costing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/costing/application/ports/out/RecordStore'
import { DefinirTaxaCusto } from '@/contexts/costing/application/ports/in/DefinirTaxaCusto'
import { CostingError } from '@/contexts/costing/domain/CostingError'

const CHAVES = ['taxa_fixa_min', 'taxa_moi_min', 'taxa_depreciacao_min']

export class DefinirTaxaCustoService implements DefinirTaxaCusto {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}
  async execute(cmd: {
    chave: string
    valor: number
    centroId?: string | null
    vigenciaInicio: string
    vigenciaFim?: string | null
  }): Promise<Result<{ id: string }>> {
    if (!CHAVES.includes(cmd.chave)) return fail(`chave inválida: ${cmd.chave} (use ${CHAVES.join(' | ')})`)
    const id = await this.registry.entityIdBySlug('parametros_de_custo')
    if (!id) return fail(CostingError.entidadeFaltando)
    const novoId = await this.store.insert(id, {
      chave: cmd.chave, valor: cmd.valor, escopo_centro: cmd.centroId ?? null,
      vigencia_inicio: cmd.vigenciaInicio, vigencia_fim: cmd.vigenciaFim ?? null,
    })
    return ok({ id: novoId })
  }
}
