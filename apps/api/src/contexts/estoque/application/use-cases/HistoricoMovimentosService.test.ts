import { describe, it, expect } from 'vitest'
import { testWorld } from '@/contexts/estoque/adapters/out/fake/testWorld'
import { HistoricoMovimentosService } from '@/contexts/estoque/application/use-cases/HistoricoMovimentosService'
import { RegistrarMovimentoService } from '@/contexts/estoque/application/use-cases/RegistrarMovimentoService'

const svc = (store: ReturnType<typeof testWorld>['store']) =>
  new HistoricoMovimentosService(store, store)

describe('HistoricoMovimentosService', () => {
  it('devolve os movimentos NEWEST-FIRST, e cada um carrega saldoTotalApos e custoMedioApos', async () => {
    const { store } = testWorld()
    const reg = new RegistrarMovimentoService(store, store)
    await reg.execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 100, custoUnitario: 10 })
    await reg.execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 100, custoUnitario: 20 })

    const r = await svc(store).execute({ insumoId: 'TECIDO' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.movimentos).toHaveLength(2)
    // NEWEST-FIRST (espelha `created_at DESC` do engine real): [0] é a SEGUNDA entrada.
    expect(r.value.movimentos[0].saldoTotalApos).toBe(200)
    expect(r.value.movimentos[0].custoMedioApos).toBeCloseTo(15, 10)
    expect(r.value.movimentos[1].saldoTotalApos).toBe(100)
    expect(r.value.movimentos[1].custoMedioApos).toBe(10)
    // O livro se explica sozinho: dá para reconstruir a evolução do custo médio linha a linha.
    expect(r.value.truncado).toBe(false)
  })

  // `truncado` é a "saturação declarada": é o mecanismo pelo qual um custo errado NÃO
  // passa despercebido num histórico que bateu no teto sem avisar.
  it('truncado é TRUE quando a consulta SATURA o limite pedido', async () => {
    const { store } = testWorld()
    const reg = new RegistrarMovimentoService(store, store)
    for (let i = 0; i < 5; i++) {
      await reg.execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 10, custoUnitario: 10 })
    }
    const r = await svc(store).execute({ insumoId: 'TECIDO', limite: 3 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.movimentos).toHaveLength(3)
    expect(r.value.truncado).toBe(true)
  })

  it('truncado é FALSE quando a consulta NÃO satura o limite', async () => {
    const { store } = testWorld()
    const reg = new RegistrarMovimentoService(store, store)
    await reg.execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 10, custoUnitario: 10 })

    const r = await svc(store).execute({ insumoId: 'TECIDO', limite: 10 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.movimentos).toHaveLength(1)
    expect(r.value.truncado).toBe(false)
  })

  // Um `limite` negativo chegaria ao engine real como `LIMIT -n`, erro de Postgres, uma vez
  // que o MCP/HTTP passem esse parâmetro adiante sem validar. Clampado para pelo menos 1.
  it('limite ZERO ou NEGATIVO não explode: é clampado para pelo menos 1', async () => {
    const { store } = testWorld()
    const reg = new RegistrarMovimentoService(store, store)
    await reg.execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 10, custoUnitario: 10 })

    const rZero = await svc(store).execute({ insumoId: 'TECIDO', limite: 0 })
    expect(rZero.ok).toBe(true)
    if (rZero.ok) expect(rZero.value.movimentos.length).toBeGreaterThanOrEqual(1)

    const rNeg = await svc(store).execute({ insumoId: 'TECIDO', limite: -5 })
    expect(rNeg.ok).toBe(true)
    if (rNeg.ok) expect(rNeg.value.movimentos.length).toBeGreaterThanOrEqual(1)
  })
})
