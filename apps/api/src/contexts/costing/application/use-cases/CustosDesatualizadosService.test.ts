import { describe, it, expect } from 'vitest'
import { InMemoryRecordStore } from '@/contexts/costing/adapters/out/fake/InMemoryRecordStore'
import { CustosDesatualizadosService } from '@/contexts/costing/application/use-cases/CustosDesatualizadosService'

const E = {
  modelos: 'E_MODELOS', produtos: 'E_PRODUTOS',
  explodidas: 'E_EXPLODIDAS', snapshots: 'E_SNAPSHOTS',
} as const

// Um mundo mínimo: 1 modelo, 1 SKU, 1 insumo, 1 ficha explodida, 1 snapshot.
function mundo(opts: { snapshotEm: string | null; insumoEm?: string }) {
  const store = new InMemoryRecordStore()
  store.seedEntity('modelos', E.modelos)
  store.seedEntity('produtos', E.produtos)
  store.seedEntity('fichas_explodidas', E.explodidas)
  store.seedEntity('snapshots_custo', E.snapshots)

  store.seedRecord(E.modelos, { id: 'MOD1', version: 1, data: { nome: 'CAMPESINA' } })
  store.seedRecord(E.produtos, { id: 'SKU1', version: 1, data: { produto: 'CAMPESINA P', modelo: 'MOD1' } })
  store.seedRecord(E.produtos, {
    id: 'TECIDO', version: 1,
    data: { produto: 'SARJA', custo_medio: 12, ...(opts.insumoEm ? { custo_medio_atualizado_em: opts.insumoEm } : {}) },
  })
  store.seedRecord(E.explodidas, { id: 'FE1', version: 1, data: { sku: 'SKU1', item: 'TECIDO', custo_total: 15 } })
  if (opts.snapshotEm) {
    store.seedRecord(E.snapshots, { id: 'SN1', version: 1, data: { sku: 'SKU1', data: opts.snapshotEm, custo_total: 64.62 } })
  }
  return store
}

const svc = (store: InMemoryRecordStore) => new CustosDesatualizadosService(store, store)

describe('CustosDesatualizadosService', () => {
  it('acusa o SKU cujo insumo ficou mais novo que o snapshot', async () => {
    const store = mundo({ snapshotEm: '2026-07-01T00:00:00.000Z', insumoEm: '2026-07-12T00:00:00.000Z' })
    const r = await svc(store).execute({})
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.skus).toHaveLength(1)
    expect(r.value.skus[0]).toMatchObject({
      skuId: 'SKU1',
      modeloId: 'MOD1',
      snapshotEm: '2026-07-01T00:00:00.000Z',
      insumoAtualizadoEm: '2026-07-12T00:00:00.000Z',
      insumos: ['TECIDO'],
    })
    expect(r.value.truncado).toBe(false)
  })

  it('NÃO acusa quando o snapshot é mais novo que o insumo', async () => {
    const store = mundo({ snapshotEm: '2026-07-12T00:00:00.000Z', insumoEm: '2026-07-01T00:00:00.000Z' })
    const r = await svc(store).execute({})
    expect(r.ok && r.value.skus).toEqual([])
  })

  // Insumo que NUNCA teve movimento de estoque: sem carimbo, sem defasagem.
  it('NÃO acusa quando o insumo nunca teve o custo médio atualizado', async () => {
    const store = mundo({ snapshotEm: '2026-07-01T00:00:00.000Z' })
    const r = await svc(store).execute({})
    expect(r.ok && r.value.skus).toEqual([])
  })

  // Ficha explodida sem snapshot: o custo nunca foi gravado. Defasado por definição.
  it('acusa o SKU que tem ficha explodida mas nenhum snapshot', async () => {
    const store = mundo({ snapshotEm: null, insumoEm: '2026-07-12T00:00:00.000Z' })
    const r = await svc(store).execute({})
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.skus).toHaveLength(1)
    expect(r.value.skus[0].snapshotEm).toBeNull()
  })

  // O buraco: SEM snapshot E com um insumo que NUNCA teve movimento de estoque (sem carimbo).
  // `defasados` ficava vazio e o SKU sumia do aviso, mesmo com o custo nunca tendo sido gravado.
  it('acusa o SKU sem snapshot mesmo quando NENHUM insumo tem carimbo', async () => {
    const store = mundo({ snapshotEm: null })   // sem insumoEm: o TECIDO nunca se moveu
    const r = await svc(store).execute({})
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.skus).toHaveLength(1)
    expect(r.value.skus[0].skuId).toBe('SKU1')
    expect(r.value.skus[0].snapshotEm).toBeNull()
    expect(r.value.skus[0].insumos).toEqual(['TECIDO'])
  })

  it('SKU sem ficha explodida (nunca custeado) é ignorado', async () => {
    const store = mundo({ snapshotEm: '2026-07-01T00:00:00.000Z', insumoEm: '2026-07-12T00:00:00.000Z' })
    store.seedRecord(E.produtos, { id: 'SKU_NOVO', version: 1, data: { produto: 'X', modelo: 'MOD1' } })
    const r = await svc(store).execute({})
    expect(r.ok && r.value.skus.map((s) => s.skuId)).toEqual(['SKU1'])
  })

  it('usa o snapshot MAIS RECENTE do SKU', async () => {
    const store = mundo({ snapshotEm: '2026-07-01T00:00:00.000Z', insumoEm: '2026-07-05T00:00:00.000Z' })
    store.seedRecord(E.snapshots, {
      id: 'SN2', version: 1,
      data: { sku: 'SKU1', data: '2026-07-10T00:00:00.000Z', custo_total: 70 },
    })
    // O mais recente (10/07) é POSTERIOR ao insumo (05/07): não está defasado.
    const r = await svc(store).execute({})
    expect(r.ok && r.value.skus).toEqual([])
  })

  it('filtra por modelo quando modeloId é informado', async () => {
    const store = mundo({ snapshotEm: '2026-07-01T00:00:00.000Z', insumoEm: '2026-07-12T00:00:00.000Z' })
    store.seedRecord(E.modelos, { id: 'MOD2', version: 1, data: { nome: 'OUTRO' } })

    const doModelo = await svc(store).execute({ modeloId: 'MOD1' })
    expect(doModelo.ok && doModelo.value.skus.map((s) => s.skuId)).toEqual(['SKU1'])

    const doOutro = await svc(store).execute({ modeloId: 'MOD2' })
    expect(doOutro.ok && doOutro.value.skus).toEqual([])
  })

  it('lista todos os insumos defasados de um SKU', async () => {
    const store = mundo({ snapshotEm: '2026-07-01T00:00:00.000Z', insumoEm: '2026-07-05T00:00:00.000Z' })
    store.seedRecord(E.produtos, {
      id: 'LINHA', version: 1,
      data: { produto: 'LINHA', custo_medio: 2, custo_medio_atualizado_em: '2026-07-12T00:00:00.000Z' },
    })
    store.seedRecord(E.explodidas, { id: 'FE2', version: 1, data: { sku: 'SKU1', item: 'LINHA', custo_total: 3 } })

    const r = await svc(store).execute({})
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.skus[0].insumos.sort()).toEqual(['LINHA', 'TECIDO'])
    // O carimbo reportado é o MAIS RECENTE entre os insumos defasados.
    expect(r.value.skus[0].insumoAtualizadoEm).toBe('2026-07-12T00:00:00.000Z')
  })

  // SATURAÇÃO DECLARADA. Se a consulta bate no teto de 500 do engine, há linhas que NÃO vieram,
  // e o chamador precisa saber que a resposta é PARCIAL. Sem este teste, uma regressão que
  // apagasse os `saturou(...)` diria "completo" sobre uma resposta truncada, em silêncio.
  it('declara truncado quando a consulta bate no teto do engine', async () => {
    const store = mundo({ snapshotEm: '2026-07-01T00:00:00.000Z', insumoEm: '2026-07-12T00:00:00.000Z' })
    // 500 linhas de ficha explodida para o mesmo SKU: a consulta satura.
    for (let i = 0; i < 500; i++) {
      store.seedRecord(E.explodidas, { id: `FE_${i}`, version: 1, data: { sku: 'SKU1', item: 'TECIDO', custo_total: 1 } })
    }
    const r = await svc(store).execute({})
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.truncado).toBe(true)
  })

  it('falha quando as entidades não estão provisionadas', async () => {
    const store = new InMemoryRecordStore()
    const r = await svc(store).execute({})
    expect(r.ok).toBe(false)
  })
})
