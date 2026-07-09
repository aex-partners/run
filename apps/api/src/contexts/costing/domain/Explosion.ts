export interface FichaLineInput {
  itemId: string
  isFantasma: boolean
  unidade: string
  qtyBase: number
  qtyPorTamanho: Record<string, number>
}
export interface SkuVariacao {
  id: string
  fatorQtd: number | null
}

// Quantity of a ficha line for a specific SKU: explicit cell > base*factor > base.
export function resolveQuantidade(line: FichaLineInput, skuVariacoes: SkuVariacao[]): number {
  for (const v of skuVariacoes) {
    const cell = line.qtyPorTamanho[v.id]
    if (cell != null) return cell
  }
  for (const v of skuVariacoes) {
    if (v.fatorQtd != null) return line.qtyBase * (v.fatorQtd / 100)
  }
  return line.qtyBase
}

export interface Substituicao { variacaoId: string; deItemId: string; paraItemId: string }

export function resolveItem(
  line: FichaLineInput,
  skuVariacaoIds: string[],
  subs: Substituicao[],
): { itemId: string; resolved: boolean } {
  if (!line.isFantasma) return { itemId: line.itemId, resolved: true }
  const skuSet = new Set(skuVariacaoIds)
  const hit = subs.find((s) => s.deItemId === line.itemId && skuSet.has(s.variacaoId))
  return hit ? { itemId: hit.paraItemId, resolved: true } : { itemId: line.itemId, resolved: false }
}

export interface ExplodedLine {
  itemIdOriginal: string
  itemIdResolvido: string
  qty: number
  custoUnit: number
  custoTotal: number
  unidade: string
  naoResolvido: boolean
  custoFaltando: boolean
}
export interface ExplosionInput {
  lines: FichaLineInput[]
  skuVariacoes: SkuVariacao[]
  substituicoes: Substituicao[]
  custos: Record<string, number | null>
}
export interface ExplosionResult { lines: ExplodedLine[]; custoTotal: number; erros: string[] }

export function explodeFicha(input: ExplosionInput): ExplosionResult {
  const skuIds = input.skuVariacoes.map((v) => v.id)
  const erros: string[] = []
  const lines: ExplodedLine[] = input.lines.map((line) => {
    const qty = resolveQuantidade(line, input.skuVariacoes)
    const { itemId, resolved } = resolveItem(line, skuIds, input.substituicoes)
    const naoResolvido = !resolved
    if (naoResolvido) erros.push(`slot não resolvido: item fantasma ${line.itemId} sem substituição para as variações do SKU`)
    const rawCusto = resolved ? input.custos[itemId] : null
    const custoFaltando = resolved && (rawCusto == null)
    if (custoFaltando) erros.push(`custo faltando: item ${itemId} sem preço de custo`)
    const custoUnit = rawCusto ?? 0
    return {
      itemIdOriginal: line.itemId,
      itemIdResolvido: itemId,
      qty,
      custoUnit,
      custoTotal: qty * custoUnit,
      unidade: line.unidade,
      naoResolvido,
      custoFaltando,
    }
  })
  const custoTotal = lines.reduce((s, l) => s + l.custoTotal, 0)
  return { lines, custoTotal, erros }
}
