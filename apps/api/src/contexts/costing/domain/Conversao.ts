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

// FACTORY, não constante compartilhada: `erros` é um array mutável e um único objeto
// module-level viraria um singleton do processo. Um `conv.erros.push(...)` de qualquer caller
// contaminaria TODA explosão seguinte. Cada chamada devolve uma instância nova.
export function conversaoVazia(): ConversaoResult {
  return { operacoes: [], tempoTotalMin: 0, custoMod: 0, custoIndireto: 0, custoConversao: 0, erros: [] }
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
//
// CONTRATO DE ORDEM (não é detalhe de implementação, é parte da assinatura):
// `rows` chega ORDENADO DO MAIS NOVO PARA O MAIS VELHO (o query engine do data devolve
// `ORDER BY created_at DESC`; o InMemoryRecordStore dos testes espelha isso). O desempate abaixo
// usa `>` ESTRITO, então num empate EXATO (mesma chave, mesmo escopo_centro, mesma vigenciaInicio)
// vence a PRIMEIRA linha do array — a MAIS NOVA.
//
// Por que isso importa: `DefinirTaxaCusto` só faz INSERT, nunca update. "Digitei a taxa errada,
// vou definir de novo a partir da mesma data" é o fluxo NATURAL de correção e produz exatamente
// esse empate. Com a ordem newest-first, a correção vence; se a lista chegasse oldest-first, a
// linha ERRADA (a velha) venceria e o custo continuaria errado, em silêncio.
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

// A taxa EM VIGOR para (chave, centro), ou `undefined` se NÃO EXISTE nenhuma.
//
// A distinção AUSENTE vs. ZERO é o ponto: `pickTaxa` colapsa as duas em `0`, e um 0 por ausência
// (nenhum parametro_de_custo cadastrado, todos expirados, janela invertida) zera o custo indireto
// sem uma linha de erro — que é EXATAMENTE o estado final do bug de truncagem, alcançável sem
// truncagem nenhuma. Quem precisa reclamar (computeConversao) usa esta função; quem só precisa do
// número usa `pickTaxa`. Taxa do centro sobrepõe a global.
export function acharTaxa(taxas: TaxaVigente[], chave: string, centroId: string | null): TaxaVigente | undefined {
  const doCentro = centroId ? taxas.find((t) => t.chave === chave && t.centroId === centroId) : undefined
  return doCentro ?? taxas.find((t) => t.chave === chave && t.centroId == null)
}

// Taxa do centro sobrepõe a global. Nenhuma -> 0.
export function pickTaxa(taxas: TaxaVigente[], chave: string, centroId: string | null): number {
  return acharTaxa(taxas, chave, centroId)?.valor ?? 0
}

export function computeConversao(input: {
  operacoes: OperacaoInput[]; centros: Record<string, CentroInput>
  taxas: TaxaVigente[]; skuVariacoes: SkuVariacao[]
}): ConversaoResult {
  const erros: string[] = []
  // Centros (resolvíveis) para os quais NENHUMA das três chaves de absorção tem taxa em vigor.
  // Reportados UMA vez por centro no fim, não por operação: um roteiro de 20 operações no mesmo
  // centro produziria 20 cópias da mesma mensagem e afogaria os outros erros.
  const semTaxaAlguma = new Set<string>()

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

    // AUSÊNCIA, não zero: as três chaves resolvidas por `acharTaxa`. Se NENHUMA existe, não há
    // absorção nenhuma em vigor e o indireto sai 0 — o mesmo dinheiro faltando do bug de
    // truncagem, mas com um roteiro perfeitamente sadio. Uma taxa que EXISTE valendo 0 é uma
    // decisão legítima e NÃO reclama. SOFT: o custo é calculado do mesmo jeito.
    const vigentes = CHAVES_INDIRETAS.map((chave) => acharTaxa(input.taxas, chave, op.centroId))
    if (!semCentro && vigentes.every((t) => t === undefined)) semTaxaAlguma.add(centro.id)

    const taxaIndireta = vigentes.reduce((s, t) => s + (t?.valor ?? 0), 0)
    const custoIndireto = taxaIndireta * tempoMin

    return {
      operacaoId: op.id, centroId: op.centroId, tempoMin,
      custoMod, custoIndireto, custoTotal: custoMod + custoIndireto, semCentro,
    }
  })

  for (const centroId of semTaxaAlguma) {
    erros.push(
      `centro ${centroId}: nenhuma taxa de absorção vigente (fixa/MOI/depreciação): custo indireto = 0 ` +
      '(cadastre em parametros_de_custo com definir_taxa_custo, ou confira as vigências)',
    )
  }

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
