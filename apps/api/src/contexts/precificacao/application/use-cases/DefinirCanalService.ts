import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/precificacao/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/precificacao/application/ports/out/RecordStore'
import { DefinirCanal } from '@/contexts/precificacao/application/ports/in/DefinirCanal'
import { PrecificacaoError } from '@/contexts/precificacao/domain/PrecificacaoError'
import { validarPercent } from '@/contexts/precificacao/domain/percent'

export class DefinirCanalService implements DefinirCanal {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}
  async execute(cmd: { id?: string; nome: string; comissao: number; frete?: number; ativo?: boolean }): Promise<Result<{ id: string }>> {
    const eid = await this.registry.entityIdBySlug('canais_de_venda')
    if (!eid) return fail(PrecificacaoError.entidadeFaltando)
    for (const [campo, v] of [['comissao', cmd.comissao], ['frete', cmd.frete ?? 0]] as const) {
      const e = validarPercent(campo, v); if (e) return fail(e)
    }
    const data = { nome: cmd.nome, comissao: cmd.comissao, frete: cmd.frete ?? 0, ativo: cmd.ativo ?? true }
    if (!cmd.id) return ok({ id: await this.store.insert(eid, data) })
    const ex = await this.store.get(cmd.id)
    if (!ex) return fail(PrecificacaoError.canalNaoEncontrado)
    await this.store.update(ex.id, { ...ex.data, ...data }, ex.version)
    return ok({ id: ex.id })
  }
}
