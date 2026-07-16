import { describe, it, expect } from 'vitest'
import { InMemoryRecordStore } from '@/contexts/precificacao/adapters/out/fake/InMemoryRecordStore'
import { PrecosDesatualizadosService } from '@/contexts/precificacao/application/use-cases/PrecosDesatualizadosService'

const E = { modelos: 'M', produtos: 'P', snaps: 'S', precos: 'PR' }
function mundo(o: { precoEm: string | null; custoEm: string | null }) {
  const s = new InMemoryRecordStore()
  s.seedEntity('modelos', E.modelos); s.seedEntity('produtos', E.produtos)
  s.seedEntity('snapshots_custo', E.snaps); s.seedEntity('precos_de_venda', E.precos)
  s.seedRecord(E.modelos, { id: 'MOD', version: 1, data: { nome: 'CAMPESINA' } })
  s.seedRecord(E.produtos, { id: 'SKU', version: 1, data: { produto: 'X', modelo: 'MOD' } })
  if (o.custoEm) s.seedRecord(E.snaps, { id: 'SN', version: 1, data: { sku: 'SKU', data: o.custoEm } })
  if (o.precoEm) s.seedRecord(E.precos, { id: 'PV', version: 1, data: { sku: 'SKU', canal: 'L', condicao: 'A', data: o.precoEm } })
  return s
}
const svc = (s: InMemoryRecordStore) => new PrecosDesatualizadosService(s, s)

describe('PrecosDesatualizadosService', () => {
  it('acusa quando o custo é mais novo que o preço', async () => {
    const r = await svc(mundo({ precoEm: '2026-07-01T00:00:00.000Z', custoEm: '2026-07-16T00:00:00.000Z' })).execute({})
    expect(r.ok && r.value.skus).toHaveLength(1)
  })
  it('NÃO acusa quando o preço é mais novo que o custo', async () => {
    const r = await svc(mundo({ precoEm: '2026-07-16T00:00:00.000Z', custoEm: '2026-07-01T00:00:00.000Z' })).execute({})
    expect(r.ok && r.value.skus).toEqual([])
  })
  it('SKU com custo mas SEM preço gerado é defasado (nunca foi precificado)', async () => {
    const r = await svc(mundo({ precoEm: null, custoEm: '2026-07-16T00:00:00.000Z' })).execute({})
    expect(r.ok && r.value.skus).toHaveLength(1)
  })
  it('SKU sem custo (sem snapshot) é ignorado', async () => {
    const r = await svc(mundo({ precoEm: null, custoEm: null })).execute({})
    expect(r.ok && r.value.skus).toEqual([])
  })

  // SATURAÇÃO DECLARADA. Se uma consulta bate no teto de 500 do engine, há linhas que NÃO
  // vieram, e a resposta é PARCIAL. Sem este teste, uma regressão que apagasse um saturou(...)
  // diria "completo" sobre uma varredura truncada, e num sistema de AVISO isso deixa um preço
  // defasado passar como se estivesse em dia.
  it('declara truncado quando uma consulta bate no teto do engine', async () => {
    const s = mundo({ precoEm: '2026-07-01T00:00:00.000Z', custoEm: '2026-07-16T00:00:00.000Z' })
    // 500 snapshots para o mesmo SKU: a consulta de snapshots satura.
    for (let i = 0; i < 500; i++) {
      s.seedRecord(E.snaps, { id: `SN_${i}`, version: 1, data: { sku: 'SKU', data: '2026-07-16T00:00:00.000Z' } })
    }
    const r = await svc(s).execute({})
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.truncado).toBe(true)
  })
})
