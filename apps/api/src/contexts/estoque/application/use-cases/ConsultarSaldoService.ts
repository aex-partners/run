import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/estoque/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/estoque/application/ports/out/RecordStore'
import { ConsultarSaldo, SaldoView } from '@/contexts/estoque/application/ports/in/ConsultarSaldo'
import { EstoqueError } from '@/contexts/estoque/domain/EstoqueError'

const LIMITE = 500
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

// A entidade `depositos` NÃO nasceu aqui: ela já existia, vinda do espelho do Bling, e lá os
// depósitos guardam o nome em `descricao` (os 3 reais em produção são "Geral", "Fábrica
// Panambi" e "Loja Panambi"). O provisionamento do estoque acrescentou o campo `nome`, que
// fica VAZIO nesses registros. Ler só `nome` faria o saldo exibir o UUID cru do depósito no
// lugar do nome dele — foi o que o smoke em produção mostrou.
const nomeDoDeposito = (data: Record<string, unknown> | undefined, fallbackId: string): string => {
  for (const chave of ['nome', 'descricao']) {
    const v = data?.[chave]
    if (typeof v === 'string' && v.trim() !== '') return v
  }
  return fallbackId
}

export class ConsultarSaldoService implements ConsultarSaldo {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(q: { insumoId: string }): Promise<Result<SaldoView>> {
    const saldosId = await this.registry.entityIdBySlug('saldos_de_estoque')
    if (!saldosId) return fail(EstoqueError.entidadeFaltando)

    const insumo = await this.store.get(q.insumoId)
    if (!insumo) return fail(EstoqueError.insumoNaoEncontrado)

    const rows = await this.store.query(saldosId, [{ field: 'insumo', op: 'eq', value: q.insumoId }], LIMITE)
    const porDeposito: SaldoView['porDeposito'] = []
    for (const r of rows) {
      const depId = String(r.data.deposito ?? '')
      const dep = depId ? await this.store.get(depId) : null
      porDeposito.push({ depositoId: depId, deposito: nomeDoDeposito(dep?.data, depId), qtd: num(r.data.qtd) })
    }

    return ok({
      insumoId: q.insumoId,
      unidadeConsumo: String(insumo.data.unidade_consumo ?? ''),
      custoMedio: num(insumo.data.custo_medio),
      saldoTotal: num(insumo.data.saldo_total),
      porDeposito,
    })
  }
}
