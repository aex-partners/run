import { describe, it, expect } from 'vitest'
import { testWorld, E } from '@/contexts/precificacao/adapters/out/fake/testWorld'
import { GerarPrecosService } from '@/contexts/precificacao/application/use-cases/GerarPrecosService'
import { ConsultarPrecoService } from '@/contexts/precificacao/application/use-cases/ConsultarPrecoService'

const svc = (s: ReturnType<typeof testWorld>['store']) => new GerarPrecosService(s, s)

describe('GerarPrecosService', () => {
  it('grava o preço da planilha para o SKU (lojista à vista lucro 0 → R$ 74,56)', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({ skuId: 'SKU' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.gravados).toBe(2)   // 1 canal × 2 condições
    const precos = await store.query(E.precos, [{ field: 'sku', op: 'eq', value: 'SKU' }], 500)
    const aVista = precos.find((p) => p.data.condicao === 'AVISTA')!
    expect(Number(aVista.data.preco)).toBeCloseTo(74.556728940299664, 4)
    expect(Number(aVista.data.custo_base)).toBeCloseTo(64.6183, 3)
    expect(JSON.parse(String(aVista.data.componentes)).comissao).toBe(0.10)
  })

  it('a prazo sai mais caro que à vista', async () => {
    const { store } = testWorld()
    await svc(store).execute({ skuId: 'SKU' })
    const precos = await store.query(E.precos, [{ field: 'sku', op: 'eq', value: 'SKU' }], 500)
    const aVista = Number(precos.find((p) => p.data.condicao === 'AVISTA')!.data.preco)
    const prazo = Number(precos.find((p) => p.data.condicao === 'PRAZO30')!.data.preco)
    expect(prazo).toBeGreaterThan(aVista)
  })

  it('re-gerar SUBSTITUI as linhas do SKU, não acumula', async () => {
    const { store } = testWorld()
    await svc(store).execute({ skuId: 'SKU' })
    await svc(store).execute({ skuId: 'SKU' })
    const precos = await store.query(E.precos, [{ field: 'sku', op: 'eq', value: 'SKU' }], 500)
    expect(precos).toHaveLength(2)   // não 4
  })

  it('SKU sem custo é pulado com erro suave, nada gravado', async () => {
    const { store } = testWorld()
    store.seedRecord(E.produtos, { id: 'SEMCUSTO', version: 1, data: { produto: 'X', modelo: 'MOD', custo_unitario_total: 0 } })
    const r = await svc(store).execute({ skuId: 'SEMCUSTO' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.gravados).toBe(0)
    expect(r.value.erros.length).toBeGreaterThan(0)
    expect(await store.query(E.precos, [{ field: 'sku', op: 'eq', value: 'SEMCUSTO' }], 500)).toHaveLength(0)
  })

  it('lucro que estoura (Σ%≥100%) pula a célula com erro suave, sem gravar preço negativo', async () => {
    const { store } = testWorld()
    // lucro 0,95 + comissão 0,10 + imposto 0,0333 = 108% -> sem preço
    await new (await import('@/contexts/precificacao/application/use-cases/DefinirLucroService')).DefinirLucroService(store, store)
      .execute({ modeloId: 'MOD', canalId: 'LOJISTA', lucroAlvo: 0.95 })
    const r = await svc(store).execute({ skuId: 'SKU' })
    expect(r.ok && r.value.gravados).toBe(0)
    expect(r.ok && r.value.erros.length).toBeGreaterThan(0)
  })

  it('usa o lucro da política do (modelo, canal)', async () => {
    const { store } = testWorld()
    await new (await import('@/contexts/precificacao/application/use-cases/DefinirLucroService')).DefinirLucroService(store, store)
      .execute({ modeloId: 'MOD', canalId: 'LOJISTA', lucroAlvo: 0.10 })
    await svc(store).execute({ skuId: 'SKU' })
    const p = (await store.query(E.precos, [{ field: 'sku', op: 'eq', value: 'SKU' }], 500))[0]!
    expect(Number(p.data.lucro_usado)).toBe(0.10)
  })

  it('skuIds vazio é recusado (no-op que parece sucesso)', async () => {
    const { store } = testWorld()
    expect((await svc(store).execute({ skuIds: [] })).ok).toBe(false)
  })
})

describe('ConsultarPrecoService', () => {
  it('devolve a tabela do SKU depois de gerar', async () => {
    const { store } = testWorld()
    await svc(store).execute({ skuId: 'SKU' })
    const r = await new ConsultarPrecoService(store, store).execute({ skuId: 'SKU' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.precos).toHaveLength(2)
    expect(r.value.custoBase).toBeCloseTo(64.6183, 3)
  })
})
