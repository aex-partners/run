import { Result, ok, fail } from '@/shared/kernel/Result'
import { RecordStore } from '@/contexts/precificacao/application/ports/out/RecordStore'
import { DefinirCondicaoFinanceira } from '@/contexts/precificacao/application/ports/in/DefinirCondicaoFinanceira'
import { validarPercent } from '@/contexts/precificacao/domain/percent'

export class DefinirCondicaoFinanceiraService implements DefinirCondicaoFinanceira {
  constructor(private readonly store: RecordStore) {}
  async execute(cmd: { condicaoId: string; despFinanceira: number }): Promise<Result<{ id: string }>> {
    const e = validarPercent('despFinanceira', cmd.despFinanceira)
    if (e) return fail(e)
    // Não cria entidade: condições de pagamento já existem (Bling); aqui só se ajusta
    // a desp. financeira preservando o resto do registro.
    const ex = await this.store.get(cmd.condicaoId)
    if (!ex) return fail('condição não encontrada')
    await this.store.update(ex.id, { ...ex.data, desp_financeira: cmd.despFinanceira }, ex.version)
    return ok({ id: ex.id })
  }
}
