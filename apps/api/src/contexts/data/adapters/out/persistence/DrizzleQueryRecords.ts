import { sql, or, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { entities, entityRecords } from '@/platform/db/schema'
import { Json } from '@/shared/domain/Json'
import {
  QueryRecords,
  QueryRecordsSpec,
  QueryRecordsResult,
  QueryGroup,
} from '@/contexts/data/application/queries/QueryRecords'
import { DrizzleEntityMapper } from '@/contexts/data/adapters/out/persistence/DrizzleEntityMapper'
import {
  buildWhere,
  buildOrderBy,
  buildAggregateSelect,
  resolveFieldRef,
  jsonText,
} from '@/contexts/data/adapters/out/persistence/queryEngine'

// Read-side adapter. Ports the AI `query` tool's dynamic engine: filter,
// aggregate, group, sort, paginate over an entity's JSON records.
export class DrizzleQueryRecords implements QueryRecords {
  constructor(private readonly db: Database) {}

  async execute(spec: QueryRecordsSpec): Promise<QueryRecordsResult> {
    const [entityRow] = await this.db
      .select()
      .from(entities)
      .where(or(eq(entities.id, spec.entity), eq(entities.slug, spec.entity), eq(entities.name, spec.entity)))
      .limit(1)
    if (!entityRow) throw new Error(`Entity "${spec.entity}" not found`)

    const entity = DrizzleEntityMapper.toDomain(entityRow)
    const fields = [...entity.fields()]
    const where = buildWhere(fields, spec.where)
    const entityFilter = where
      ? sql`${entityRecords.entityId} = ${entityRow.id} AND (${where})`
      : sql`${entityRecords.entityId} = ${entityRow.id}`

    const aggs = spec.aggregate
    const groupBy = spec.group_by

    if ((aggs && aggs.length > 0) || (groupBy && groupBy.length > 0)) {
      const agg = buildAggregateSelect(fields, aggs ?? [{ fn: 'count', as: 'count' }])
      const groupFields = (groupBy ?? []).map((g) => resolveFieldRef(fields, g))
      const groupSelect = groupFields.map((f) => sql`${jsonText(f)} AS ${sql.identifier(f.name.value)}`)
      const selectItems = groupSelect.length
        ? sql`${sql.join(groupSelect, sql`, `)}, ${agg.items}`
        : agg.items
      const groupClause = groupFields.length
        ? sql` GROUP BY ${sql.join(
            groupFields.map((_, i) => sql.raw(String(i + 1))),
            sql`, `,
          )}`
        : sql``
      const q = sql`SELECT ${selectItems} FROM ${entityRecords} WHERE ${entityFilter}${groupClause}`
      const rows = (await this.db.execute(q)) as unknown as Array<Record<string, unknown>>
      const groups: QueryGroup[] = rows.map((r) => {
        const key: { [slug: string]: Json } = {}
        for (const f of groupFields) key[f.name.value] = r[f.name.value] as Json
        const values: { [name: string]: Json } = {}
        for (const name of agg.names) {
          const rawVal = r[name]
          if (rawVal === null || rawVal === undefined) {
            values[name] = null
            continue
          }
          if (rawVal instanceof Date) {
            values[name] = rawVal.toISOString().slice(0, 10)
            continue
          }
          const n = Number(rawVal)
          values[name] = Number.isNaN(n) ? (rawVal as Json) : n
        }
        return groupFields.length ? { key, values } : { values }
      })
      return { entity: entity.slug, groups }
    }

    const limit = Math.min(spec.limit ?? 50, 500)
    const offset = spec.offset ?? 0
    const orderBy = buildOrderBy(fields, spec.order_by)
    const rowsQ = sql`SELECT id, version, data FROM ${entityRecords} WHERE ${entityFilter} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`
    const countQ = sql`SELECT count(*)::int AS total FROM ${entityRecords} WHERE ${entityFilter}`
    const rawRows = (await this.db.execute(rowsQ)) as unknown as Array<{ id: string; version: number; data: string }>
    const countRows = (await this.db.execute(countQ)) as unknown as Array<{ total: number }>

    const allowed = new Set(fields.map((f) => f.name.value))
    const selectSet = spec.select ? new Set(spec.select) : null
    const rows = rawRows.map((r) => {
      const data = JSON.parse(r.data) as { [k: string]: Json }
      const filtered = Object.fromEntries(
        Object.entries(data).filter(([k]) => allowed.has(k) && (!selectSet || selectSet.has(k))),
      )
      return { id: r.id, version: Number(r.version), data: filtered }
    })
    return { entity: entity.slug, total: countRows[0]?.total ?? 0, rows }
  }
}
