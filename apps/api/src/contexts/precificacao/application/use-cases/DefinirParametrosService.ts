import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/precificacao/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/precificacao/application/ports/out/RecordStore'
import { DefinirParametros } from '@/contexts/precificacao/application/ports/in/DefinirParametros'
import { PrecificacaoError } from '@/contexts/precificacao/domain/PrecificacaoError'
import { validarPercent } from '@/contexts/precificacao/domain/percent'

export class DefinirParametrosService implements DefinirParametros {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}
  async execute(cmd: { imposto: number; iss?: number }): Promise<Result<{ id: string }>> {
    const eid = await this.registry.entityIdBySlug('parametros_de_preco')
    if (!eid) return fail(PrecificacaoError.entidadeFaltando)
    for (const [campo, v] of [['imposto', cmd.imposto], ['iss', cmd.iss ?? 0]] as const) {
      const e = validarPercent(campo, v); if (e) return fail(e)
    }
    const data = { imposto: cmd.imposto, iss: cmd.iss ?? 0 }
    // parametros_de_preco é LINHA ÚNICA: se já existir uma, atualiza a primeira; senão insere.
    const [ex] = await this.store.query(eid, [])
    if (!ex) return ok({ id: await this.store.insert(eid, data) })
    await this.store.update(ex.id, data, ex.version)
    return ok({ id: ex.id })
  }
}
