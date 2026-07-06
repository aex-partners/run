import type { Row } from './types'

/**
 * Contrato de paginacao SERVER-SIDE + filtro em arvore, compartilhado pela
 * TableView. As `fetchPage` reais (ver adapter.ts) mapeiam a `PageQuery` para a
 * tRPC `entities.query` e devolvem `{ rows, total, aggregateRows }`. Os helpers
 * puros (filterRows/sortRows) sao reusados pelo modo CLIENTE da tabela.
 */
/** uma condicao (folha) do filtro. */
export interface FilterCond {
  fieldId: string
  op: string
  value: string
}
/** um grupo: combina filhos (condicoes ou subgrupos) por E/OU. Permite aninhar. */
export interface FilterGroup {
  conj: 'and' | 'or'
  items: FilterNode[]
}
export type FilterNode = FilterCond | FilterGroup
export function isGroup(n: FilterNode): n is FilterGroup {
  return (n as FilterGroup).items !== undefined
}

export interface PageQuery {
  limit: number
  offset: number
  sort?: { id: string; desc: boolean }[]
  /** arvore de filtros (grupo raiz). */
  filter?: FilterGroup
}
/**
 * Agregações numéricas de UM campo, pré-calculadas em SQL sobre o conjunto
 * FILTRADO completo (sem teto de linhas). Alimenta o rodapé numérico
 * (sum/avg/min/max/count) sem puxar linhas pro cliente. `total` = total de linhas
 * do conjunto filtrado (p/ derivar "vazios" = total - count).
 */
export interface FieldAggregate {
  sum: number
  avg: number
  min: number
  max: number
  /** contagem de valores não-nulos (preenchidos). */
  count: number
  total: number
}

export interface PageResult {
  rows: Row[]
  total: number
  /**
   * conjunto FILTRADO completo (pre-paginacao), usado p/ os breakdowns
   * CATEGÓRICOS do rodapé (contagem por valor), export CSV e "selecionar tudo".
   * BOUNDED: pode vir truncado (o adapter loga ao atingir o teto). Números do
   * rodapé NÃO saem daqui — vêm de `aggregates` (SQL, sem teto).
   */
  aggregateRows: Row[]
  /**
   * Agregações numéricas por campo (id do good-views), calculadas em SQL sobre o
   * conjunto filtrado inteiro. Quando presente, o rodapé numérico lê daqui em vez
   * de iterar `aggregateRows` — correto mesmo com > teto de linhas.
   */
  aggregates?: Record<string, FieldAggregate>
}

function isEmpty(v: unknown): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0)
}
// condicao "ativa" = tem valor (ou e vazio/preenchido que nao precisa de valor)
function activeCond(c: FilterCond): boolean {
  return c.op === 'vazio' || c.op === 'preenchido' || c.value !== ''
}
function hasActive(n: FilterNode): boolean {
  return isGroup(n) ? n.items.some(hasActive) : activeCond(n)
}
function matchNode(row: Row, n: FilterNode): boolean {
  if (!isGroup(n)) return matchCond(row, n)
  const kids = n.items.filter(hasActive)
  if (!kids.length) return true
  return n.conj === 'or' ? kids.some((k) => matchNode(row, k)) : kids.every((k) => matchNode(row, k))
}
function matchCond(row: Row, c: FilterCond): boolean {
  const v = row[c.fieldId]
  const val = c.value
  switch (c.op) {
    case 'vazio': return isEmpty(v)
    case 'preenchido': return !isEmpty(v)
    case 'contém': return String(v ?? '').toLowerCase().includes(val.toLowerCase())
    case '=': return String(v ?? '') === val
    case '≠': return String(v ?? '') !== val
    case '>': return Number(v) > Number(val)
    case '<': return Number(v) < Number(val)
    case '≥': return Number(v) >= Number(val)
    case '≤': return Number(v) <= Number(val)
    case 'tem': return Array.isArray(v) ? (v as unknown[]).map(String).includes(val) : String(v ?? '') === val
    default: return true
  }
}

function compare(a: unknown, b: unknown): number {
  if (a == null || a === '') return b == null || b === '' ? 0 : 1
  if (b == null || b === '') return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'pt-BR')
}

// helpers puros (reusados pelo modo CLIENTE da tabela)
export function filterRows(rows: Row[], filter?: FilterGroup): Row[] {
  return filter && hasActive(filter) ? rows.filter((row) => matchNode(row, filter)) : rows
}
export function sortRows(rows: Row[], sort?: { id: string; desc: boolean }[]): Row[] {
  if (!sort || !sort.length) return rows
  return [...rows].sort((ra, rb) => {
    for (const s of sort) {
      const r = compare(ra[s.id], rb[s.id])
      if (r !== 0) return s.desc ? -r : r
    }
    return 0
  })
}
