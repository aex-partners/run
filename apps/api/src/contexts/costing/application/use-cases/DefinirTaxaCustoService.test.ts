import { describe, it, expect } from 'vitest'
import { seedWorld } from '@/contexts/costing/adapters/out/fake/testWorld'
import { DefinirTaxaCustoService } from '@/contexts/costing/application/use-cases/DefinirTaxaCustoService'
import { taxasVigentes, TaxaRow } from '@/contexts/costing/domain/Conversao'

describe('DefinirTaxaCusto', () => {
  it('records a rate with its validity window', async () => {
    const s = seedWorld()
    const r = await new DefinirTaxaCustoService(s, s).execute({
      chave: 'taxa_moi_min', valor: 0.0323, vigenciaInicio: '2026-07-01',
    })
    expect(r.ok).toBe(true)
    const rows = await s.query('PARAMETROS', [{ field: 'chave', op: 'eq', value: 'taxa_moi_min' }], 500)
    expect(rows[0].data.valor).toBe(0.0323)
    expect(rows[0].data.vigencia_fim).toBeNull()
  })
  it('rejects an unknown key', async () => {
    const s = seedWorld()
    const r = await new DefinirTaxaCustoService(s, s).execute({ chave: 'bogus', valor: 1, vigenciaInicio: '2026-01-01' })
    expect(r.ok).toBe(false)
  })

  // As datas de vigência são comparadas como STRING. Fora do ISO YYYY-MM-DD a comparação vira
  // lixo: '01/07/2026' <= hoje é FALSO (a taxa nunca entra em vigor) e, pior, uma vigenciaFim
  // '31/12/2025' NUNCA expira ('2026-07-12' <= '31/12/2025' é TRUE, porque '2' < '3'), então uma
  // taxa MORTA continua em vigor para sempre e o dinheiro muda em silêncio.
  describe('guarda o formato das datas de vigência (ISO YYYY-MM-DD)', () => {
    it('rejeita vigenciaInicio fora do ISO', async () => {
      const s = seedWorld()
      const r = await new DefinirTaxaCustoService(s, s).execute({
        chave: 'taxa_fixa_min', valor: 1, vigenciaInicio: '01/07/2026',
      })
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.error).toContain('vigenciaInicio')
      // e NADA foi gravado: a taxa envenenada não chega ao banco
      const rows = await s.query('PARAMETROS', [{ field: 'valor', op: 'eq', value: 1 }], 500)
      expect(rows).toHaveLength(0)
    })

    it('rejeita vigenciaFim fora do ISO (a janela que nunca expira)', async () => {
      const s = seedWorld()
      const r = await new DefinirTaxaCustoService(s, s).execute({
        chave: 'taxa_fixa_min', valor: 1, vigenciaInicio: '2026-07-01', vigenciaFim: '31/12/2025',
      })
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.error).toContain('vigenciaFim')
    })

    it('aceita ISO válido, com e sem vigenciaFim', async () => {
      const s = seedWorld()
      const svc = new DefinirTaxaCustoService(s, s)
      expect((await svc.execute({ chave: 'taxa_moi_min', valor: 0.03, vigenciaInicio: '2026-07-01' })).ok).toBe(true)
      expect((await svc.execute({
        chave: 'taxa_moi_min', valor: 0.04, vigenciaInicio: '2026-07-01', vigenciaFim: '2026-12-31',
      })).ok).toBe(true)
      // vigenciaFim null explícito = vigência aberta, também aceito
      expect((await svc.execute({
        chave: 'taxa_moi_min', valor: 0.05, vigenciaInicio: '2026-08-01', vigenciaFim: null,
      })).ok).toBe(true)
    })
  })

  // DESEMPATE DETERMINÍSTICO. `DefinirTaxaCusto` só faz INSERT: "digitei errado, defino de novo a
  // partir da mesma data" é o fluxo NATURAL de correção e cria um empate EXATO (mesma chave, mesmo
  // escopo, mesma vigenciaInicio). Quem vence é decidido pela POSIÇÃO na lista — e a lista chega
  // NEWEST-FIRST (ORDER BY created_at DESC), então a CORREÇÃO vence. Este teste passa pelo store
  // de verdade (insert -> query -> taxasVigentes), que é onde o contrato de ordem realmente vale.
  it('empate exato (mesma chave/escopo/vigenciaInicio): vence a taxa inserida DEPOIS (a correção)', async () => {
    const s = seedWorld()
    const svc = new DefinirTaxaCustoService(s, s)

    await svc.execute({ chave: 'taxa_moi_min', valor: 0.10, vigenciaInicio: '2026-01-01' })   // errada
    await svc.execute({ chave: 'taxa_moi_min', valor: 0.99, vigenciaInicio: '2026-01-01' })   // correção

    const rows = await s.query('PARAMETROS', [{ field: 'chave', op: 'eq', value: 'taxa_moi_min' }], 500)
    const taxaRows: TaxaRow[] = rows.map((r) => ({
      chave: String(r.data.chave),
      centroId: r.data.escopo_centro == null ? null : String(r.data.escopo_centro),
      valor: Number(r.data.valor),
      vigenciaInicio: String(r.data.vigencia_inicio),
      vigenciaFim: r.data.vigencia_fim == null ? null : String(r.data.vigencia_fim),
    }))

    const vigentes = taxasVigentes(taxaRows, '2026-07-10')
    expect(vigentes).toHaveLength(1)
    expect(vigentes[0]!.valor).toBe(0.99)      // a CORREÇÃO, não a linha velha
  })
})
