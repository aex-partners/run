import { Json } from '@/shared/domain/Json'

// Read side. The dynamic query engine behind the AI `query` tool: filter,
// aggregate, group, sort, paginate over an entity's JSON records. The pure spec
// lives here; the SQL building (jsonb extraction + casts) lives in the Drizzle
// adapter, which asks the domain FieldType for each field's CastKind.

export type WhereOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'in'
  | 'between'
  | 'is_null'
  | 'is_not_null'

export type AggFn = 'count' | 'sum' | 'avg' | 'min' | 'max'

export interface Condition {
  field: string
  op: WhereOp
  value?: Json
  values?: Json[]
}

export interface AggSpec {
  fn: AggFn
  field?: string
  as?: string
}

export interface OrderSpec {
  field: string
  dir?: 'asc' | 'desc'
}

export interface QueryRecordsSpec {
  entity: string
  select?: string[]
  where?: Condition[]
  order_by?: OrderSpec[]
  group_by?: string[]
  aggregate?: AggSpec[]
  limit?: number
  offset?: number
}

export interface QueryRowsResult {
  entity: string
  total: number
  // `version` is the record's optimistic-concurrency token — carried so a paged
  // read side (the web Table View) can echo it back on updateRecord (CAS).
  rows: { id: string; version: number; data: { [slug: string]: Json } }[]
}

export interface QueryGroup {
  key?: { [slug: string]: Json }
  values: { [name: string]: Json }
}

export interface QueryGroupsResult {
  entity: string
  groups: QueryGroup[]
}

export type QueryRecordsResult = QueryRowsResult | QueryGroupsResult

export interface QueryRecords {
  execute(spec: QueryRecordsSpec): Promise<QueryRecordsResult>
}
