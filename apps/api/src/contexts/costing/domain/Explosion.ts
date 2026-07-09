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
