// A single line of the document. Values are decimals in reais (the adapter formats
// them to the SEFAZ-required precision). Tax classification is expressed as EITHER
// `cst` (regime normal) OR `csosn` (Simples Nacional); the use-case/adapter pick the
// right one from the emitente regime, so both are optional here. `origem` is the
// SEFAZ product-origin code ("0" = nacional).
export interface FiscalItem {
  readonly descricao: string
  readonly ncm: string
  readonly cfop: string
  readonly cst?: string
  readonly csosn?: string
  readonly origem: string
  readonly unidade: string
  readonly quantidade: number
  readonly valorUnitario: number
  readonly valorTotal: number
}

// Line total in reais, rounded to 2 decimals. Pure.
export const itemTotal = (quantidade: number, valorUnitario: number): number =>
  Math.round(quantidade * valorUnitario * 100) / 100
