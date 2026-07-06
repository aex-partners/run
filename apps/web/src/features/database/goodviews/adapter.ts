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
import type { PageQuery, PageResult, FilterGroup, FilterNode, FieldAggregate } from './server'
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
  // Campo relation (type 'relationship'): entidade-alvo apontada.
  relationshipEntityId?: string
  relationshipEntityName?: string
  // Relation: campo do alvo exibido como rótulo (resolveLabels honra) + multi.
  labelFieldId?: string
  multiple?: boolean
  // Campo rating: nº máximo de estrelas.
  maxRating?: number
  // Campo currency: código ISO da moeda (default BRL no toFields).
  currencyCode?: string
  // Campos derivados (lookup/rollup): `viaFieldId` = id do campo relation por onde
  // navega; `lookupFieldId` = campo (id/slug) lido no registro-alvo. Vindos de
  // entities.getById (DescribeEntity).
  viaFieldId?: string
  lookupFieldId?: string
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

// ---- agregação SQL (rodapé): espelha entities.aggregate ----
export type ServerAggOp = 'count' | 'sum' | 'avg' | 'min' | 'max'
export interface ServerAggregateInput {
  entityId: string
  filter?: ServerCondition[]
  aggregates: { field: string; op: ServerAggOp }[]
}
export interface ServerAggregateResult {
  aggregates: { field: string; op: ServerAggOp; value: Json }[]
}
/** calcula agregações numéricas em SQL sobre o conjunto FILTRADO completo (sem teto). */
export type AggregateFn = (input: ServerAggregateInput) => Promise<ServerAggregateResult>

// ---- resolução do valor de um campo (lookup): espelha entities.resolveFieldValues ----
export type ResolveFieldValuesFn = (input: {
  entityId: string
  ids: string[]
  fieldSlug: string
}) => Promise<{ values: { id: string; value: Json }[] }>

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
    case 'autonumber':
    case 'formula':
      return 'number'
    // rollup é numérico, mas o valor NÃO é populado pelo backend hoje: exigiria
    // agregação por relação-reversa (indexar quem aponta p/ este registro), que o
    // engine atual não oferece. Mantemos number (read-only na célula) — ver
    // toFields (readonly) e o comentário do rollup em makeFetchPage.
    case 'rollup':
      return 'number'
    case 'rating':
      return 'rating'
    case 'duration':
      return 'duration'
    case 'boolean':
    case 'checkbox':
      return 'boolean'
    case 'email':
      return 'email'
    case 'phone':
      return 'phone'
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
    // Campo derivado: lê `lookupFieldId` do registro apontado por `viaFieldId`.
    // Resolvido/injetado por injectLookupValues; célula somente-leitura.
    case 'lookup':
      return 'lookup'
    case 'attachment':
      return 'file'
    default:
      return 'text'
  }
}

// good-views FieldType -> run-hex/AEX type string (inverso parcial de toGvType).
// Usado pela edição de schema (addField/updateField) p/ mandar o tipo ao backend.
export function toAexType(t: FieldType): string {
  switch (t) {
    case 'longtext': return 'long_text'
    case 'number': return 'number'
    case 'currency': return 'currency'
    case 'percent': return 'percent'
    case 'date': return 'date'
    case 'select': return 'select'
    case 'status': return 'status'
    case 'multiselect': return 'multiselect'
    case 'person': return 'person'
    case 'url': return 'url'
    case 'relation': return 'relation'
    case 'boolean': return 'checkbox' // AEX guarda boolean como 'checkbox'
    case 'email': return 'email'
    case 'phone': return 'phone'
    case 'rating': return 'rating'
    case 'duration': return 'duration'
    case 'lookup': return 'lookup'
    case 'file':
    case 'image': return 'attachment'
    case 'text':
    case 'id':
    case 'geo':
    default: return 'text'
  }
}

const OPTION_TYPES: FieldType[] = ['select', 'status', 'multiselect', 'person']

// Tipos run-hex derivados/computados/de sistema: a célula é somente-leitura (o
// valor é resolvido pelo backend/host, o usuário não edita).
const READONLY_TYPES = new Set([
  'lookup', 'rollup', 'formula', 'autonumber',
  'created_at', 'updated_at', 'created_by', 'updated_by',
])

export function toFields(fields: RunHexField[]): Field[] {
  return fields.map((f) => {
    const type = toGvType(f.type)
    const field: Field = { id: f.slug, label: f.name || f.slug, type }
    if (f.options?.length && OPTION_TYPES.includes(type)) {
      field.options = f.options.map((o) => ({ value: o.value, label: o.label, color: o.color }))
      if (type === 'multiselect') field.creatable = false
    }
    if (type === 'currency') field.currency = f.currencyCode || 'BRL'
    if (type === 'rating') field.maxRating = f.maxRating ?? 5
    // relation -> nome da entidade-alvo (usado por views de arvore/grafo) + config
    // type-específica p/ o editor de schema (entidade-alvo, rótulo, multi).
    if (type === 'relation') {
      if (f.relationshipEntityName) field.relationTo = f.relationshipEntityName
      if (f.relationshipEntityId) field.relationEntityId = f.relationshipEntityId
      if (f.labelFieldId) field.labelFieldId = f.labelFieldId
      if (f.multiple) field.multiple = true
    }
    // lookup -> via/lookup ids p/ o editor de schema (via relação + campo a puxar).
    if (type === 'lookup') {
      if (f.viaFieldId) field.viaFieldId = f.viaFieldId
      if (f.lookupFieldId) field.lookupFieldId = f.lookupFieldId
    }
    if (READONLY_TYPES.has(f.type)) field.readonly = true
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

// Tipos run-hex agregáveis numericamente em SQL (castKind 'numeric' no backend).
// EXCLUI rollup (derivado, castKind 'text' -> sum/avg/min/max lançaria erro no
// engine) e rating/duration (o rodapé os trata como não-numéricos hoje).
const NUMERIC_AGG_TYPES = new Set(['number', 'decimal', 'currency', 'percent', 'autonumber', 'formula'])

// Le o conjunto FILTRADO completo (paginando) p/ os breakdowns CATEGÓRICOS do
// rodapé, export CSV e "selecionar tudo". BOUNDED em MAX_AGG_ROWS: ao atingir o
// teto, LOGA (não trunca em silêncio). Os NÚMEROS do rodapé não saem daqui — vêm
// de computeAggregates (SQL, sem teto). Ordem é irrelevante; cacheia por filtro.
async function fetchFiltered(entityId: string, queryFn: QueryFn, filter: ServerCondition[] | undefined, cache: RowCache): Promise<Row[]> {
  const out: Row[] = []
  let offset = 0
  for (;;) {
    const res = await queryFn({ entityId, filter, limit: PAGE, offset })
    for (const r of res.rows) out.push(toRow(r, cache))
    offset += res.rows.length
    if (res.rows.length < PAGE || offset >= res.total) break
    if (offset >= MAX_AGG_ROWS) {
      console.warn(
        `[good-views] conjunto filtrado > ${MAX_AGG_ROWS} linhas (total ${res.total}): ` +
          `breakdowns categóricos, export CSV e "selecionar tudo" limitados às primeiras ${MAX_AGG_ROWS}. ` +
          `Os números do rodapé (soma/média/etc) vêm do SQL e não são afetados.`,
      )
      break
    }
  }
  return out
}

// Números do rodapé em SQL: para cada campo numérico pede sum/avg/min/max/count
// (op 'count' = valores preenchidos) sobre o conjunto FILTRADO inteiro, numa única
// chamada. `total` (total do filtro) permite derivar "vazios" = total - count.
async function computeAggregates(
  entityId: string,
  aggregateFn: AggregateFn,
  filter: ServerCondition[] | undefined,
  numericSlugs: string[],
  total: number,
): Promise<Record<string, FieldAggregate>> {
  if (numericSlugs.length === 0) return {}
  const ops: ServerAggOp[] = ['sum', 'avg', 'min', 'max', 'count']
  const reqs = numericSlugs.flatMap((field) => ops.map((op) => ({ field, op })))
  const res = await aggregateFn({ entityId, filter, aggregates: reqs })
  const byField: Record<string, FieldAggregate> = {}
  for (const slug of numericSlugs) byField[slug] = { sum: 0, avg: 0, min: 0, max: 0, count: 0, total }
  for (const a of res.aggregates) {
    const agg = byField[a.field]
    if (!agg) continue
    const n = a.value == null ? 0 : Number(a.value)
    const val = Number.isNaN(n) ? 0 : n
    if (a.op === 'sum') agg.sum = val
    else if (a.op === 'avg') agg.avg = val
    else if (a.op === 'min') agg.min = val
    else if (a.op === 'max') agg.max = val
    else if (a.op === 'count') agg.count = val
  }
  return byField
}

// ---------- rotulos de relacao: resolve id-alvo -> LABEL (titulo) do alvo ----------

/**
 * Busca em lote os rotulos dos registros-alvo de uma entidade. `labelFieldId`
 * (opcional) escolhe qual campo do alvo vira o rótulo; sem ele o backend cai na
 * heurística de título (TITLE_FIELD_BY_ENTITY / primeiro texto).
 */
export type ResolveLabelsFn = (input: {
  entityId: string
  ids: string[]
  labelFieldId?: string
}) => Promise<{ labels: { id: string; label: string }[] }>

/** cache id-alvo -> label, chaveado por (entidade-alvo + labelFieldId). Memoiza. */
export type LabelCache = Map<string, string>
const labelKey = (targetEntityId: string, labelFieldId: string | undefined, id: string): string =>
  `${targetEntityId}:${labelFieldId ?? ''}:${id}`

interface RelField {
  slug: string
  targetEntityId: string
  /** campo do alvo a exibir como rótulo (id/slug); vazio = heurística de título. */
  labelFieldId?: string
}

/** campos relation da entidade (com entidade-alvo conhecida), p/ resolver rotulos. */
function relationFieldsOf(fields: RunHexField[]): RelField[] {
  return fields
    .filter((f) => (f.type === 'relation' || f.type === 'relationship') && !!f.relationshipEntityId)
    .map((f) => ({ slug: f.slug, targetEntityId: f.relationshipEntityId as string, labelFieldId: f.labelFieldId }))
}

/**
 * Resolve + injeta: em cada campo relation, troca o id (cru) pelo LABEL do
 * registro-alvo, na forma que a celula relation espera (string do rotulo — a
 * celula faz `String(value)`). Ids ja conhecidos vem do cache; os novos sao
 * buscados em lote por entidade-alvo. Ids sem rotulo mantem o id cru.
 */
async function injectRelationLabels(
  rows: Row[],
  relFields: RelField[],
  resolveLabels: ResolveLabelsFn,
  labelCache: LabelCache,
): Promise<void> {
  if (relFields.length === 0) return
  // 1) ids faltantes (fora do cache) agrupados por (entidade-alvo + labelFieldId),
  // pois dois campos relation p/ a mesma entidade podem exibir rótulos diferentes.
  const missing = new Map<string, { targetEntityId: string; labelFieldId?: string; ids: Set<string> }>()
  for (const rf of relFields) {
    for (const row of rows) {
      const v = row[rf.slug]
      if (v == null || v === '') continue
      const id = String(v)
      if (labelCache.has(labelKey(rf.targetEntityId, rf.labelFieldId, id))) continue
      const gk = `${rf.targetEntityId}::${rf.labelFieldId ?? ''}`
      const g = missing.get(gk) ?? { targetEntityId: rf.targetEntityId, labelFieldId: rf.labelFieldId, ids: new Set<string>() }
      g.ids.add(id)
      missing.set(gk, g)
    }
  }
  // 2) busca em lote (uma chamada por grupo) e povoa o cache
  await Promise.all(
    [...missing.values()].map(async (g) => {
      const res = await resolveLabels({ entityId: g.targetEntityId, ids: [...g.ids], labelFieldId: g.labelFieldId })
      for (const { id, label } of res.labels) labelCache.set(labelKey(g.targetEntityId, g.labelFieldId, id), label)
    }),
  )
  // 3) injeta o rotulo resolvido (mantem o id cru quando nao ha rotulo)
  for (const rf of relFields) {
    for (const row of rows) {
      const v = row[rf.slug]
      if (v == null || v === '') continue
      const label = labelCache.get(labelKey(rf.targetEntityId, rf.labelFieldId, String(v)))
      if (label !== undefined) row[rf.slug] = label
    }
  }
}

// ---------- lookup: resolve o valor de um campo do registro-alvo da relação ----------

interface LookupField {
  /** slug do campo lookup (onde injetar o valor resolvido). */
  slug: string
  /** slug do campo relation por onde o lookup navega. */
  relSlug: string
  /** entidade-alvo da relation. */
  targetEntityId: string
  /** campo lido no registro-alvo (id ou slug; o backend resolve). */
  lookupFieldRef: string
}

/**
 * Campos lookup resolvíveis: cada um precisa de `viaFieldId` (um campo relation
 * DESTA entidade, casado por id ou slug, com entidade-alvo conhecida) e de
 * `lookupFieldId` (o campo lido no alvo). Sem esses dados o lookup fica vazio.
 */
function lookupFieldsOf(fields: RunHexField[]): LookupField[] {
  const byId = new Map(fields.map((f) => [f.id, f]))
  const bySlug = new Map(fields.map((f) => [f.slug, f]))
  const out: LookupField[] = []
  for (const f of fields) {
    if (f.type !== 'lookup' || !f.viaFieldId || !f.lookupFieldId) continue
    const rel = byId.get(f.viaFieldId) ?? bySlug.get(f.viaFieldId)
    if (!rel || !rel.relationshipEntityId) continue
    out.push({ slug: f.slug, relSlug: rel.slug, targetEntityId: rel.relationshipEntityId, lookupFieldRef: f.lookupFieldId })
  }
  return out
}

const lookupKey = (targetEntityId: string, fieldRef: string, id: string): string =>
  `${targetEntityId}:${fieldRef}:${id}`

// id-alvo da relação numa linha (relação single ou o 1º item de uma array).
function relTargetId(row: Row, relSlug: string): string | null {
  const v = row[relSlug]
  if (v == null || v === '') return null
  return Array.isArray(v) ? (v.length ? String(v[0]) : null) : String(v)
}

/**
 * Resolve + injeta os campos lookup da PÁGINA: para cada lookup, lê o id-alvo da
 * relação (`viaFieldId`), busca em lote o `lookupFieldId` desses alvos (uma
 * chamada por entidade-alvo + campo) e injeta o valor na célula do lookup. Ids já
 * resolvidos vêm do cache (memoiza entre páginas/ordenação).
 */
async function injectLookupValues(
  rows: Row[],
  lookupFields: LookupField[],
  resolveFieldValues: ResolveFieldValuesFn,
  cache: Map<string, Json>,
): Promise<void> {
  if (lookupFields.length === 0) return
  // 1) ids faltantes (fora do cache) agrupados por (entidade-alvo + campo lido)
  const missing = new Map<string, { targetEntityId: string; fieldRef: string; ids: Set<string> }>()
  for (const lf of lookupFields) {
    for (const row of rows) {
      const id = relTargetId(row, lf.relSlug)
      if (!id || cache.has(lookupKey(lf.targetEntityId, lf.lookupFieldRef, id))) continue
      const groupKey = `${lf.targetEntityId}:${lf.lookupFieldRef}`
      const g = missing.get(groupKey) ?? { targetEntityId: lf.targetEntityId, fieldRef: lf.lookupFieldRef, ids: new Set<string>() }
      g.ids.add(id)
      missing.set(groupKey, g)
    }
  }
  // 2) busca em lote (uma chamada por grupo) e povoa o cache
  await Promise.all(
    [...missing.values()].map(async (g) => {
      const res = await resolveFieldValues({ entityId: g.targetEntityId, ids: [...g.ids], fieldSlug: g.fieldRef })
      for (const { id, value } of res.values) cache.set(lookupKey(g.targetEntityId, g.fieldRef, id), value)
    }),
  )
  // 3) injeta o valor resolvido na célula do campo lookup
  for (const lf of lookupFields) {
    for (const row of rows) {
      const id = relTargetId(row, lf.relSlug)
      if (!id) continue
      const val = cache.get(lookupKey(lf.targetEntityId, lf.lookupFieldRef, id))
      if (val !== undefined) row[lf.slug] = val
    }
  }
}

/**
 * Constroi a `fetchPage` (modo SERVER da TableView). Cada chamada busca a pagina
 * (limit/offset/sort/filter). Por FILTRO (memoizado): calcula os números do rodapé
 * em SQL (`computeAggregates`, sem teto) e, quando há campos que precisam do
 * conjunto de linhas (categóricos/data/texto p/ breakdown, CSV, selecionar-tudo),
 * busca esse conjunto BOUNDED (`fetchFiltered`). Grids puramente numéricos não
 * puxam linha nenhuma.
 *
 * Se `resolveLabels` + `labelCache` forem dados, resolve os campos relation da
 * PÁGINA (id-alvo -> label do alvo). Se `resolveFieldValues` for dado, resolve os
 * campos lookup (valor do `lookupFieldId` do registro apontado pela relação).
 */
export function makeFetchPage(
  entityId: string,
  queryFn: QueryFn,
  cache: RowCache,
  fields: RunHexField[] = [],
  resolveLabels?: ResolveLabelsFn,
  labelCache?: LabelCache,
  aggregateFn?: AggregateFn,
  resolveFieldValues?: ResolveFieldValuesFn,
): (q: PageQuery) => Promise<PageResult> {
  let aggKey: string | null = null
  let aggRows: Row[] = []
  let aggValues: Record<string, FieldAggregate> = {}
  const relFields = relationFieldsOf(fields)
  const lookupFields = lookupFieldsOf(fields)
  const numericSlugs = fields.filter((f) => NUMERIC_AGG_TYPES.has(f.type)).map((f) => f.slug)
  // linhas só são necessárias p/ breakdown categórico, export CSV e "selecionar
  // tudo". Grid 100% numérico (todo campo -> number/currency/percent) não puxa
  // linha: o rodapé numérico vem inteiro do SQL.
  const needsRowSet = fields.some((f) => {
    const t = toGvType(f.type)
    return t !== 'number' && t !== 'currency' && t !== 'percent'
  })
  const lookupCache = new Map<string, Json>()
  return async (q: PageQuery): Promise<PageResult> => {
    const filter = toServerFilter(q.filter)
    const sort = toServerSort(q.sort)
    const page = await queryFn({ entityId, filter, sort, limit: q.limit, offset: q.offset })
    const rows = page.rows.map((r) => toRow(r, cache))
    // Lookup ANTES dos rótulos: lê o id CRU da relação (`viaFieldId`) — a injeção
    // de rótulos troca a célula da relação pelo label e apagaria o id-alvo.
    if (resolveFieldValues && lookupFields.length) {
      await injectLookupValues(rows, lookupFields, resolveFieldValues, lookupCache)
    }
    if (resolveLabels && labelCache && relFields.length) {
      await injectRelationLabels(rows, relFields, resolveLabels, labelCache)
    }
    const key = JSON.stringify(filter ?? null)
    if (key !== aggKey) {
      // números: SQL sobre o filtro inteiro (sem teto). linhas: bounded + só se preciso.
      aggValues = aggregateFn ? await computeAggregates(entityId, aggregateFn, filter, numericSlugs, page.total) : {}
      aggRows = needsRowSet ? await fetchFiltered(entityId, queryFn, filter, cache) : []
      aggKey = key
    }
    return { rows, total: page.total, aggregateRows: aggRows, aggregates: aggValues }
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

export interface MakeCallbacksOptions {
  /**
   * Chamado quando uma mutation FALHA, com uma mensagem pronta (PT). O host liga
   * a um toast + invalidação da query afetada, p/ a grade reconciliar com o server
   * (desfazendo a edição/remoção/criação otimista feita na TableView).
   */
  onError?: (message: string) => void
}

export function makeCallbacks(
  entityId: string,
  fields: Field[],
  cache: RowCache,
  mut: RecordMutations,
  opts: MakeCallbacksOptions = {},
): TableCallbacks {
  const typeById = new Map(fields.map((f) => [f.id, f.type]))
  const fail = (message: string) => opts.onError?.(message)
  return {
    onEdit: (rowId, fieldId, value) => {
      const cached = cache.get(rowId)
      const prev = cached?.data // snapshot p/ rollback do cache
      const data = { ...(cached?.data ?? {}), [fieldId]: toStored(value, typeById.get(fieldId)) }
      void mut
        // Sem cache de versão manda `undefined` (não um 0 forjado, que garantiria
        // conflito de CAS num registro real) e deixa o backend resolver.
        .update({ recordId: rowId, data, expectedVersion: cached?.version })
        .then((res) => cache.set(rowId, { version: res.version, data }))
        .catch(() => {
          // rollback do cache p/ o valor anterior; o host refaz o fetch e a grade concilia
          if (cached && prev) cache.set(rowId, { version: cached.version, data: prev })
          fail('Falha ao salvar a alteração')
        })
    },
    onRowDelete: (rowId) => {
      const prev = cache.get(rowId)
      cache.delete(rowId)
      void mut.remove({ recordId: rowId }).catch(() => {
        if (prev) cache.set(rowId, prev) // re-adiciona ao cache; o refetch traz a linha de volta
        fail('Falha ao excluir')
      })
    },
    onCreate: (partial) => {
      const data: { [slug: string]: Json } = {}
      for (const [k, v] of Object.entries(partial)) {
        if (k === 'id') continue
        data[k] = toStored(v, typeById.get(k))
      }
      void mut.create({ entityId, data }).catch(() => fail('Falha ao criar registro'))
    },
  }
}
