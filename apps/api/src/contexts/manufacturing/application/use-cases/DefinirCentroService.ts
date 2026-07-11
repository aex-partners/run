import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/manufacturing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/manufacturing/application/ports/out/RecordStore'
import { DefinirCentro } from '@/contexts/manufacturing/application/ports/in/DefinirCentro'
import { ManufacturingError } from '@/contexts/manufacturing/domain/ManufacturingError'

export class DefinirCentroService implements DefinirCentro {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(cmd: {
    id?: string
    nome: string
    setor: string
    custoMinMod: number
    capacidadeMinDia?: number
    numOperadores?: number
    ativo?: boolean
  }): Promise<Result<{ id: string }>> {
    const centrosId = await this.registry.entityIdBySlug('centros_de_trabalho')
    if (!centrosId) return fail(ManufacturingError.entidadeFaltando)

    const data = {
      nome: cmd.nome,
      setor: cmd.setor,
      custo_min_mod: cmd.custoMinMod,
      capacidade_min_dia: cmd.capacidadeMinDia ?? null,
      num_operadores: cmd.numOperadores ?? null,
      ativo: cmd.ativo ?? true,
    }

    if (!cmd.id) {
      const id = await this.store.insert(centrosId, data)
      return ok({ id })
    }

    const existing = await this.store.get(cmd.id)
    if (!existing) return fail(ManufacturingError.centroNaoEncontrado)
    await this.store.update(existing.id, data, existing.version)
    return ok({ id: existing.id })
  }
}
