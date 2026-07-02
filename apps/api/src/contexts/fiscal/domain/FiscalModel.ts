// The two Brazilian electronic fiscal document models this context emits, kept as
// a small stable vocabulary independent of SEFAZ's numeric codes:
//   'nfe'  -> modelo 55 (Nota Fiscal Eletrônica, B2B / movimentações entre CNPJs)
//   'nfce' -> modelo 65 (Nota Fiscal de Consumidor Eletrônica, varejo / PDV)
export type FiscalModel = 'nfe' | 'nfce'

export const isFiscalModel = (v: unknown): v is FiscalModel => v === 'nfe' || v === 'nfce'

// SEFAZ numeric model code ("55" / "65"). Returned as a string because that is how
// node-sped-nfe expects `mod` in its Tools config and in the chave layout.
export const modelCode = (m: FiscalModel): '55' | '65' => (m === 'nfe' ? '55' : '65')
