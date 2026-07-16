// Marcação (mark-up divisor), o método da planilha da Buenaça. Domínio PURO: sem I/O.
//
//   PV = custo / (1 − Σ%)   com   Σ% = imposto + iss + comissão + desp_financeira + frete + lucro
//
// Todo % é FRAÇÃO (0,10 = 10%). A borda que a planilha mostra: com Σ% >= 100%, o denominador
// vira <= 0 e o PV explodiria para negativo/infinito (as células vermelhas). Recusa DURO.

export interface Componentes {
  imposto: number
  iss: number
  comissao: number
  despFinanceira: number
  frete: number
  lucro: number
}

export interface PrecoResult {
  pv: number
  markup: number
  deducao: number
}

type Ok = { ok: true; value: PrecoResult }
type Err = { ok: false; error: string }

const CAMPOS: (keyof Componentes)[] = ['imposto', 'iss', 'comissao', 'despFinanceira', 'frete', 'lucro']

export function custearPreco(custo: number, c: Componentes): Ok | Err {
  if (!Number.isFinite(custo) || custo <= 0) {
    return { ok: false, error: `custo inválido (${custo}): um SKU sem custo real não pode ser precificado` }
  }
  for (const k of CAMPOS) {
    if (!Number.isFinite(c[k])) return { ok: false, error: `componente ${k} não é finito (${c[k]})` }
  }
  const deducao = CAMPOS.reduce((s, k) => s + c[k], 0)
  // >= 1: as deduções somam 100% ou mais. Nenhum preço cobre — barra antes da divisão.
  if (deducao >= 1) {
    return { ok: false, error: `as deduções somam ${(deducao * 100).toFixed(2)}% (>= 100%): nenhum preço cobre. Reduza o lucro ou os custos de venda.` }
  }
  const markup = 1 / (1 - deducao)
  return { ok: true, value: { pv: custo * markup, markup, deducao } }
}
