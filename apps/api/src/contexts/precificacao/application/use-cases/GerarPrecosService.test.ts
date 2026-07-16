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

  // A ORDEM que importa: o skip de custo<=0 vem ANTES do delete. Um SKU que JÁ tinha preços e
  // depois perdeu o custo NÃO pode ter a tabela apagada. Sem este teste, um delete-then-skip
  // (apaga e só então pula) passaria — apagando a tabela do SKU em silêncio.
  it('SKU que perdeu o custo mantém a tabela que já tinha (não apaga)', async () => {
    const { store } = testWorld()
    // 1) gera com custo válido -> cria as linhas
    const g1 = await svc(store).execute({ skuId: 'SKU' })
    expect(g1.ok && g1.value.gravados).toBeGreaterThan(0)
    const antes = await store.query(E.precos, [{ field: 'sku', op: 'eq', value: 'SKU' }], 500)
    expect(antes.length).toBeGreaterThan(0)
    // 2) o custo some
    const sku = (await store.get('SKU'))!
    await store.update('SKU', { ...sku.data, custo_unitario_total: 0 }, sku.version)
    // 3) re-gerar: pula (custo<=0) e NÃO apaga a tabela anterior
    const g2 = await svc(store).execute({ skuId: 'SKU' })
    expect(g2.ok).toBe(true)
    if (!g2.ok) return
    expect(g2.value.gravados).toBe(0)
    expect(g2.value.erros.length).toBeGreaterThan(0)
    const depois = await store.query(E.precos, [{ field: 'sku', op: 'eq', value: 'SKU' }], 500)
    expect(depois.length).toBe(antes.length)   // a tabela sobreviveu
  })

  // Σ%≥1 pula SÓ a célula que estoura; as outras do MESMO SKU continuam gravadas. Sem um caso
  // MISTO (uma condição passa, outra estoura), o comportamento "pula a célula, não o SKU" fica
  // sem prova.
  it('uma condição que estoura não derruba as outras do mesmo SKU', async () => {
    const { store } = testWorld()
    // uma condição com despesa financeira absurda: sozinha já passa de 100% com comissão+imposto+lucro
    store.seedRecord(E.condicoes, { id: 'ABSURDA', version: 1, data: { nome: 'absurda', desp_financeira: 0.95 } })
    const r = await svc(store).execute({ skuId: 'SKU' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // à vista e 30d gravam (2); 'absurda' estoura (0,95 + 0,10 + 0,0333 >= 1) e é pulada
    expect(r.value.gravados).toBe(2)
    expect(r.value.erros.some((e) => e.includes('absurda') || e.toLowerCase().includes('100'))).toBe(true)
    const precos = await store.query(E.precos, [{ field: 'sku', op: 'eq', value: 'SKU' }], 500)
    expect(precos.map((p) => String(p.data.condicao)).sort()).toEqual(['AVISTA', 'PRAZO30'])
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
