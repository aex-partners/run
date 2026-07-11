export interface CustoUnitarioView {
  skuId: string
  data: string
  custoMateriais: number
  custoMod: number
  custoIndireto: number
  custoTotal: number
  tempoTotalMin: number
  origemRevRoteiro: number
}

export interface CustoUnitario {
  execute(q: { skuId: string }): Promise<CustoUnitarioView | null>
}
