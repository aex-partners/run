import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/manufacturing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/manufacturing/application/ports/out/RecordStore'
import { DefinirOperacao } from '@/contexts/manufacturing/application/ports/in/DefinirOperacao'
import { ManufacturingError } from '@/contexts/manufacturing/domain/ManufacturingError'

export class DefinirOperacaoService implements DefinirOperacao {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(cmd: {
    id?: string
    modeloId: string
    seq: number
    nome: string
    centroId: string | null
    tempoPadraoMin: number
    tempoPorTamanho?: Record<string, number>
    tempoSetupMin?: number
    loteSetup?: number
    agregada?: boolean
  }): Promise<Result<{ id: string }>> {
    const opsId = await this.registry.entityIdBySlug('operacoes')
    if (!opsId) return fail(ManufacturingError.entidadeFaltando)

    const data = {
      modelo: cmd.modeloId,
      seq: cmd.seq,
      nome: cmd.nome,
      centro: cmd.centroId,
      tempo_padrao_min: cmd.tempoPadraoMin,
      tempo_por_tamanho: JSON.stringify(cmd.tempoPorTamanho ?? {}),
      tempo_setup_min: cmd.tempoSetupMin ?? 0,
      lote_setup: cmd.loteSetup ?? 1,
      agregada: cmd.agregada ?? true,
      rev: 0,
      status: 'rascunho',
    }

    if (!cmd.id) {
      const id = await this.store.insert(opsId, data)
      return ok({ id })
    }

    const existing = await this.store.get(cmd.id)
    if (!existing) return fail('operação não encontrada')
    await this.store.update(existing.id, data, existing.version)
    return ok({ id: existing.id })
  }
}
