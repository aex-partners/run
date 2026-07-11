// PURE. Custo de CONVERSÃO: mão de obra direta + despesas fixas/MOI absorvidas POR MINUTO.
// Espelha a planilha "Gestão de Custos" da Buenaça (FT xx, itens 1.2 e 1.3).
// TEMPO SEMPRE EM MINUTOS.
import { SkuVariacao } from '@/contexts/costing/domain/Explosion'

export interface OperacaoInput {
  id: string; seq: number; centroId: string | null
  tempoPadraoMin: number; tempoPorTamanho: Record<string, number>
  tempoSetupMin: number; loteSetup: number
}
export interface CentroInput { id: string; custoMinMod: number | null }

export interface TaxaRow {
  chave: string; centroId: string | null; valor: number
  vigenciaInicio: string; vigenciaFim: string | null
}
export interface TaxaVigente { chave: string; centroId: string | null; valor: number }

export interface OperacaoCusteada {
  operacaoId: string; centroId: string | null; tempoMin: number
  custoMod: number; custoIndireto: number; custoTotal: number; semCentro: boolean
}
export interface ConversaoResult {
  operacoes: OperacaoCusteada[]; tempoTotalMin: number
  custoMod: number; custoIndireto: number; custoConversao: number; erros: string[]
}
export interface CustoTotalizado { materiais: number; mod: number; indireto: number; total: number }

export const CONVERSAO_VAZIA: ConversaoResult = {
  operacoes: [], tempoTotalMin: 0, custoMod: 0, custoIndireto: 0, custoConversao: 0, erros: [],
}

const CHAVES_INDIRETAS = ['taxa_fixa_min', 'taxa_moi_min', 'taxa_depreciacao_min'] as const

// Tempo da operação para um SKU: célula por tamanho > tempo padrão; + setup amortizado pelo lote.
export function resolveTempo(op: OperacaoInput, skuVariacoes: SkuVariacao[]): number {
  let base = op.tempoPadraoMin
  for (const v of skuVariacoes) {
    const cell = op.tempoPorTamanho[v.id]
    if (cell != null) { base = cell; break }
  }
  const lote = op.loteSetup > 0 ? op.loteSetup : 1
  return base + op.tempoSetupMin / lote
}

// Taxas em vigor na data `emISO`. Empate no mesmo (chave, centro) -> vence a de início mais recente.
export function taxasVigentes(rows: TaxaRow[], emISO: string): TaxaVigente[] {
  const vigentes = rows.filter(
    (r) => r.vigenciaInicio <= emISO && (r.vigenciaFim == null || emISO <= r.vigenciaFim),
  )
  const melhor = new Map<string, TaxaRow>()
  for (const r of vigentes) {
    const k = `${r.chave}::${r.centroId ?? ''}`
    const atual = melhor.get(k)
    if (!atual || r.vigenciaInicio > atual.vigenciaInicio) melhor.set(k, r)
  }
  return [...melhor.values()].map((r) => ({ chave: r.chave, centroId: r.centroId, valor: r.valor }))
}

// Taxa do centro sobrepõe a global. Nenhuma -> 0.
export function pickTaxa(taxas: TaxaVigente[], chave: string, centroId: string | null): number {
  const doCentro = centroId ? taxas.find((t) => t.chave === chave && t.centroId === centroId) : undefined
  if (doCentro) return doCentro.valor
  const global = taxas.find((t) => t.chave === chave && t.centroId == null)
  return global ? global.valor : 0
}

export function computeConversao(input: {
  operacoes: OperacaoInput[]; centros: Record<string, CentroInput>
  taxas: TaxaVigente[]; skuVariacoes: SkuVariacao[]
}): ConversaoResult {
  const erros: string[] = []
  const operacoes: OperacaoCusteada[] = input.operacoes.map((op) => {
    const tempoMin = resolveTempo(op, input.skuVariacoes)
    const centro = op.centroId ? input.centros[op.centroId] : undefined
    const semCentro = !centro

    if (semCentro) {
      erros.push(`operação ${op.id} sem centro de trabalho: MOD não calculado (tempo ainda contabilizado)`)
    } else if (centro.custoMinMod == null) {
      erros.push(`centro ${centro.id} sem custo por minuto: MOD não calculado`)
    }

    const custoMinMod = centro?.custoMinMod ?? 0
    const custoMod = custoMinMod * tempoMin
    const taxaIndireta = CHAVES_INDIRETAS.reduce(
      (s, chave) => s + pickTaxa(input.taxas, chave, op.centroId), 0,
    )
    const custoIndireto = taxaIndireta * tempoMin

    return {
      operacaoId: op.id, centroId: op.centroId, tempoMin,
      custoMod, custoIndireto, custoTotal: custoMod + custoIndireto, semCentro,
    }
  })

  const tempoTotalMin = operacoes.reduce((s, o) => s + o.tempoMin, 0)
  const custoMod = operacoes.reduce((s, o) => s + o.custoMod, 0)
  const custoIndireto = operacoes.reduce((s, o) => s + o.custoIndireto, 0)
  return { operacoes, tempoTotalMin, custoMod, custoIndireto, custoConversao: custoMod + custoIndireto, erros }
}

export function totalizarCusto(materiais: number, c: ConversaoResult): CustoTotalizado {
  return {
    materiais,
    mod: c.custoMod,
    indireto: c.custoIndireto,
    total: materiais + c.custoMod + c.custoIndireto,
  }
}
