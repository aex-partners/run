/**
 * Ponte entre a entidade dinamica do run-hex e a Table View (good-views). Mapeia:
 *   - os campos da entidade -> `Field[]` do good-views (toFields);
 *   - a `PageQuery` do good-views -> a tRPC `entities.query` (filtro/sort/limit/
 *     offset) e devolve `PageResult` (paginado + conjunto filtrado p/ o rodape);
 *   - as edicoes inline / exclusoes / criacoes -> as mutations de record.
 *
 * Nao importa nada do @aex/api: os contratos server-side sao tipados
 * estruturalmente aqui (o call-site em DatabasePage liga com as procedures reais).
 */
import type { Field, FieldType, Row } from './types'
import type { PageQuery, PageResult, FilterGroup, FilterNode } from './server'
import { isGroup } from './server'

/** algebra JSON (espelha @/shared/domain/Json do server). */
type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

// ---- campo da entidade run-hex (subconjunto de entities.getById -> fields) ----
export interface RunHexField {
  id: string
  name: string
  slug: string
  type: string
  required?: boolean
  options?: { value: string; label: string; color?: string }[]
}

// ---- contratos server-side (estruturais; batem com RecordController) ----
type WhereOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'in' | 'between' | 'is_null' | 'is_not_null'

export interface ServerCondition {
  field: string
  op: WhereOp
  value?: string
}
export interface ServerQueryInput {
  entityId: string
  filter?: ServerCondition[]
  sort?: { field: string; dir: 'asc' | 'desc' }[]
  limit: number
  offset: number
}
export interface ServerRow {
  id: string
  version: number
  data: { [slug: string]: Json }
}
export interface ServerQueryResult {
  rows: ServerRow[]
  total: number
}
export type QueryFn = (input: ServerQueryInput) => Promise<ServerQueryResult>

export interface RecordMutations {
  update: (input: { recordId: string; data: { [slug: string]: Json }; expectedVersion?: number }) => Promise<{ version: number }>
  remove: (input: { recordId: string }) => Promise<unknown>
  create: (input: { entityId: string; data: { [slug: string]: Json } }) => Promise<{ id: string }>
}

/** cache id -> { version (CAS token), data completo } p/ o merge do onEdit. */
export type RowCache = Map<string, { version: number; data: { [slug: string]: Json } }>

// ---------- schema: run-hex field type -> good-views FieldType ----------

function toGvType(t: string): FieldType {
  switch (t) {
    case 'text':
    case 'long_text':
    case 'rich_text':
      return 'longtext'
    case 'number':
    case 'decimal':
    case 'rating':
    case 'duration':
    case 'autonumber':
    case 'formula':
    case 'rollup':
      return 'number'
    case 'currency':
      return 'currency'
    case 'percent':
      return 'percent'
    case 'date':
    case 'datetime':
    case 'created_at':
    case 'updated_at':
      return 'date'
    case 'select':
      return 'select'
    case 'status':
    case 'priority':
      return 'status'
    case 'multiselect':
      return 'multiselect'
    case 'person':
    case 'created_by':
    case 'updated_by':
      return 'person'
    case 'url':
      return 'url'
    case 'relation':
    case 'relationship':
      return 'relation'
    case 'attachment':
      return 'file'
    default:
      return 'text'
  }
}

const OPTION_TYPES: FieldType[] = ['select', 'status', 'multiselect', 'person']

export function toFields(fields: RunHexField[]): Field[] {
  return fields.map((f) => {
    const type = toGvType(f.type)
    const field: Field = { id: f.slug, label: f.name || f.slug, type }
    if (f.options?.length && OPTION_TYPES.includes(type)) {
      field.options = f.options.map((o) => ({ value: o.value, label: o.label, color: o.color }))
      if (type === 'multiselect') field.creatable = false
    }
    if (type === 'currency') field.currency = 'BRL'
    return field
  })
}

// ---------- filtro (arvore good-views) -> where plano (AND) ----------
// O engine do run-hex combina condicoes por AND (plano). Achatamos a arvore
// coletando as folhas ATIVAS (grupos OU viram AND — limitacao conhecida).

function mapOp(op: string): { op: WhereOp; needsValue: boolean } | null {
  switch (op) {
    case 'vazio': return { op: 'is_null', needsValue: false }
    case 'preenchido': return { op: 'is_not_null', needsValue: false }
    case 'contém': return { op: 'contains', needsValue: true }
    case '=': return { op: 'eq', needsValue: true }
    case '≠': return { op: 'neq', needsValue: true }
    case '>': return { op: 'gt', needsValue: true }
    case '<': return { op: 'lt', needsValue: true }
    case '≥': return { op: 'gte', needsValue: true }
    case '≤': return { op: 'lte', needsValue: true }
    case 'tem': return { op: 'contains', needsValue: true }
    default: return null
  }
}

function collect(node: FilterNode, out: ServerCondition[]): void {
  if (isGroup(node)) {
    for (const child of node.items) collect(child, out)
    return
  }
  const m = mapOp(node.op)
  if (!m) return
  if (m.needsValue && node.value === '') return
  out.push(m.needsValue ? { field: node.fieldId, op: m.op, value: node.value } : { field: node.fieldId, op: m.op })
}

export function toServerFilter(filter?: FilterGroup): ServerCondition[] | undefined {
  if (!filter) return undefined
  const out: ServerCondition[] = []
  collect(filter, out)
  return out.length ? out : undefined
}

export function toServerSort(sort?: { id: string; desc: boolean }[]): { field: string; dir: 'asc' | 'desc' }[] | undefined {
  if (!sort?.length) return undefined
  return sort.map((s) => ({ field: s.id, dir: s.desc ? 'desc' : 'asc' }))
}

// ---------- linhas server -> Row do good-views (+ cache de versao/data) ----------

function toRow(r: ServerRow, cache: RowCache): Row {
  cache.set(r.id, { version: r.version, data: r.data })
  return { id: r.id, ...r.data }
}

const PAGE = 500
const MAX_AGG_ROWS = 10000

// Le o conjunto FILTRADO completo (paginando ate o fim) p/ as agregacoes do
// rodape. Ordem e irrelevante p/ agregar, entao cacheia por filtro.
async function fetchFiltered(entityId: string, queryFn: QueryFn, filter: ServerCondition[] | undefined, cache: RowCache): Promise<Row[]> {
  const out: Row[] = []
  let offset = 0
  for (;;) {
    const res = await queryFn({ entityId, filter, limit: PAGE, offset })
    for (const r of res.rows) out.push(toRow(r, cache))
    offset += res.rows.length
    if (res.rows.length < PAGE || offset >= res.total || offset >= MAX_AGG_ROWS) break
  }
  return out
}

/**
 * Constroi a `fetchPage` (modo SERVER da TableView). Cada chamada busca a pagina
 * (limit/offset/sort/filter) e o conjunto filtrado completo (rodape). O conjunto
 * filtrado e memoizado por filtro, entao trocar de pagina/ordenacao nao rebusca.
 */
export function makeFetchPage(entityId: string, queryFn: QueryFn, cache: RowCache): (q: PageQuery) => Promise<PageResult> {
  let aggKey: string | null = null
  let aggRows: Row[] = []
  return async (q: PageQuery): Promise<PageResult> => {
    const filter = toServerFilter(q.filter)
    const sort = toServerSort(q.sort)
    const page = await queryFn({ entityId, filter, sort, limit: q.limit, offset: q.offset })
    const rows = page.rows.map((r) => toRow(r, cache))
    const key = JSON.stringify(filter ?? null)
    if (key !== aggKey) {
      aggRows = await fetchFiltered(entityId, queryFn, filter, cache)
      aggKey = key
    }
    return { rows, total: page.total, aggregateRows: aggRows }
  }
}

// ---------- serializacao de valor (good-views -> run-hex data) ----------
// multiselect vai nativo (string[]); estruturas (file/relacao multipla) viram
// JSON text (colunas string no run-hex); primitivos passam direto.
function toStored(value: unknown, gvType: FieldType | undefined): Json {
  if (value === undefined || value === null || value === '') return null
  if (gvType === 'multiselect') {
    if (Array.isArray(value)) return value.map(String)
    return [String(value)]
  }
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return String(value)
}

// ---------- callbacks: onEdit / onRowDelete / onCreate ----------

export interface TableCallbacks {
  onEdit: (rowId: string, fieldId: string, value: unknown) => void
  onRowDelete: (rowId: string) => void
  onCreate: (partial: Partial<Row>) => void
}

export function makeCallbacks(entityId: string, fields: Field[], cache: RowCache, mut: RecordMutations): TableCallbacks {
  const typeById = new Map(fields.map((f) => [f.id, f.type]))
  return {
    onEdit: (rowId, fieldId, value) => {
      const cached = cache.get(rowId)
      const data = { ...(cached?.data ?? {}), [fieldId]: toStored(value, typeById.get(fieldId)) }
      void mut
        .update({ recordId: rowId, data, expectedVersion: cached?.version ?? 0 })
        .then((res) => cache.set(rowId, { version: res.version, data }))
        .catch(() => {})
    },
    onRowDelete: (rowId) => {
      cache.delete(rowId)
      void mut.remove({ recordId: rowId }).catch(() => {})
    },
    onCreate: (partial) => {
      const data: { [slug: string]: Json } = {}
      for (const [k, v] of Object.entries(partial)) {
        if (k === 'id') continue
        data[k] = toStored(v, typeById.get(k))
      }
      void mut.create({ entityId, data }).catch(() => {})
    },
  }
}
