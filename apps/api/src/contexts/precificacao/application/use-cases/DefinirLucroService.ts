import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/precificacao/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/precificacao/application/ports/out/RecordStore'
import { DefinirLucro } from '@/contexts/precificacao/application/ports/in/DefinirLucro'
import { PrecificacaoError } from '@/contexts/precificacao/domain/PrecificacaoError'
import { validarPercent } from '@/contexts/precificacao/domain/percent'

// Sem limite explícito, RecordStore.query trunca em 50 e descarta as MAIS ANTIGAS: a linha
// (modelo,canal) existente poderia ficar de fora e o serviço duplicaria a política.
const LIMITE = 500

export class DefinirLucroService implements DefinirLucro {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}
  async execute(cmd: { modeloId: string; canalId: string; lucroAlvo: number }): Promise<Result<{ id: string }>> {
    const polId = await this.registry.entityIdBySlug('politica_de_preco')
    if (!polId) return fail(PrecificacaoError.entidadeFaltando)
    const e = validarPercent('lucroAlvo', cmd.lucroAlvo)
    if (e) return fail(e)
    const [ex] = await this.store.query(polId, [
      { field: 'modelo', op: 'eq', value: cmd.modeloId },
      { field: 'canal', op: 'eq', value: cmd.canalId },
    ], LIMITE)
    if (ex) {
      await this.store.update(ex.id, { ...ex.data, lucro_alvo: cmd.lucroAlvo }, ex.version)
      return ok({ id: ex.id })
    }
    const id = await this.store.insert(polId, { modelo: cmd.modeloId, canal: cmd.canalId, lucro_alvo: cmd.lucroAlvo })
    return ok({ id })
  }
}
