import { describe, it, expect } from 'vitest'
import { testWorld, E } from '@/contexts/estoque/adapters/out/fake/testWorld'
import { ConsultarSaldoService } from '@/contexts/estoque/application/use-cases/ConsultarSaldoService'

const svc = (store: ReturnType<typeof testWorld>['store']) =>
  new ConsultarSaldoService(store, store)

describe('ConsultarSaldoService', () => {
  it('devolve o custo médio GLOBAL e os saldos por depósito, com o NOME do depósito resolvido', async () => {
    const { store } = testWorld([{ id: 'TECIDO', saldoTotal: 150, custoMedio: 12.5, unidadeConsumo: 'MT' }])
    // Semeia saldo em DOIS depósitos diretamente (sem passar pelo RegistrarMovimentoService,
    // que já está coberto em outro arquivo): DEP1 = 'Fábrica', DEP2 = 'Loja'.
    store.seedRecord(E.saldos, { id: 'S1', version: 1, data: { insumo: 'TECIDO', deposito: 'DEP1', qtd: 100 } })
    store.seedRecord(E.saldos, { id: 'S2', version: 1, data: { insumo: 'TECIDO', deposito: 'DEP2', qtd: 50 } })

    const r = await svc(store).execute({ insumoId: 'TECIDO' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.custoMedio).toBe(12.5)
    expect(r.value.saldoTotal).toBe(150)
    expect(r.value.unidadeConsumo).toBe('MT')
    expect(r.value.porDeposito).toHaveLength(2)

    // O NOME veio resolvido (não o id cru) para os dois depósitos.
    const porNome = Object.fromEntries(r.value.porDeposito.map((d) => [d.deposito, d.qtd]))
    expect(porNome).toEqual({ Fábrica: 100, Loja: 50 })
    expect(r.value.porDeposito.every((d) => d.deposito !== d.depositoId)).toBe(true)
  })

  it('insumo desconhecido é recusado', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({ insumoId: 'FANTASMA' })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('insumo')
  })

  it('insumo sem saldo em nenhum depósito devolve lista vazia (não erro)', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({ insumoId: 'TECIDO' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.porDeposito).toEqual([])
    expect(r.value.saldoTotal).toBe(0)
    expect(r.value.custoMedio).toBe(0)
  })
})
