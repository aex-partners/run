import { sql, SQL } from 'drizzle-orm'
import { entityRecords } from '@/platform/db/schema'
import { Field } from '@/contexts/data/domain/Field'
import { Json } from '@/shared/domain/Json'
import { AggFn, Condition, OrderSpec, AggSpec } from '@/contexts/data/application/queries/QueryRecords'

// Ports ai/system-tools/query-engine.ts. The one difference: a field's
// comparison kind (numeric/date/text) comes from the domain FieldType.castKind()
// instead of a duplicated type set here — the data context owns that knowledge.

const slugOf = (f: Field): string => f.name.value

export function resolveFieldRef(fields: Field[], ref: string): Field {
  const lower = ref.toLowerCase()
  const match = fields.find(
    (f) =>
      slugOf(f) === ref ||
      f.meta.displayName === ref ||
      (f.meta.displayName ?? '').toLowerCase() === lower,
  )
  if (!match) {
    const valid = fields.map(slugOf).join(', ')
    throw new Error(`Field "${ref}" not found. Valid fields: ${valid}`)
  }
  return match
}

export function assertAggregatable(field: Field, fn: AggFn): void {
  if (fn === 'count') return
  const kind = field.type.castKind()
  if (kind === 'numeric') return
  if ((fn === 'min' || fn === 'max') && kind === 'date') return
  throw new Error(`Aggregate ${fn} requires a numeric field, but "${slugOf(field)}" is ${field.type.kind}`)
}

// NULLIF((data::jsonb ->> 'slug'), '') — raw text of a field, '' coerced to NULL.
export function jsonText(field: Field): SQL {
  return sql`NULLIF((${entityRecords.data}::jsonb ->> ${slugOf(field)}), '')`
}

export function typedExpr(field: Field): SQL {
  const kind = field.type.castKind()
  if (kind === 'numeric') return sql`${jsonText(field)}::numeric`
  if (kind === 'date') return sql`${jsonText(field)}::date`
  return jsonText(field)
}

function castParam(field: Field, value: Json | undefined): SQL {
  const kind = field.type.castKind()
  if (kind === 'numeric') return sql`${value}::numeric`
  if (kind === 'date') return sql`${value}::date`
  return sql`${value}`
}

export function conditionToSql(field: Field, cond: Condition): SQL {
  const col = typedExpr(field)
  switch (cond.op) {
    case 'eq':
      return sql`${col} = ${castParam(field, cond.value)}`
    case 'neq':
      return sql`${col} <> ${castParam(field, cond.value)}`
    case 'gt':
      return sql`${col} > ${castParam(field, cond.value)}`
    case 'gte':
      return sql`${col} >= ${castParam(field, cond.value)}`
    case 'lt':
      return sql`${col} < ${castParam(field, cond.value)}`
    case 'lte':
      return sql`${col} <= ${castParam(field, cond.value)}`
    case 'contains': {
      const esc = String(cond.value ?? '').replace(/([\\%_])/g, '\\$1')
      return sql`${jsonText(field)} ILIKE ${'%' + esc + '%'} ESCAPE '\\'`
    }
    case 'in': {
      const vals = cond.values ?? []
      if (vals.length === 0) return sql`false`
      return sql`${col} IN (${sql.join(
        vals.map((v) => castParam(field, v)),
        sql`, `,
      )})`
    }
    case 'between': {
      const [lo, hi] = cond.values ?? []
      return sql`${col} BETWEEN ${castParam(field, lo)} AND ${castParam(field, hi)}`
    }
    case 'is_null':
      return sql`${jsonText(field)} IS NULL`
    case 'is_not_null':
      return sql`${jsonText(field)} IS NOT NULL`
    default: {
      const _exhaustive: never = cond.op
      throw new Error(`Unsupported op: ${String(_exhaustive)}`)
    }
  }
}

// ANDed WHERE fragment (excludes the entity_id filter), or undefined when empty.
export function buildWhere(fields: Field[], conditions: Condition[] | undefined): SQL | undefined {
  if (!conditions || conditions.length === 0) return undefined
  const preds = conditions.map((c) => conditionToSql(resolveFieldRef(fields, c.field), c))
  return sql.join(preds, sql` AND `)
}

// ORDER BY fragment; defaults to created_at desc when no order given.
export function buildOrderBy(fields: Field[], order: OrderSpec[] | undefined): SQL {
  if (!order || order.length === 0) return sql`${entityRecords.createdAt} DESC`
  const parts = order.map((o) => {
    const f = resolveFieldRef(fields, o.field)
    const dir = o.dir === 'asc' ? sql`ASC NULLS LAST` : sql`DESC NULLS LAST`
    return sql`${typedExpr(f)} ${dir}`
  })
  return sql.join(parts, sql`, `)
}

export function buildAggregateSelect(fields: Field[], aggs: AggSpec[]): { items: SQL; names: string[] } {
  const names: string[] = []
  const items = aggs.map((a) => {
    const alias = a.as ?? (a.field ? `${a.fn}_${a.field}` : a.fn)
    names.push(alias)
    if (a.fn === 'count') {
      const inner = a.field ? jsonText(resolveFieldRef(fields, a.field)) : sql`*`
      return sql`count(${inner})::int AS ${sql.identifier(alias)}`
    }
    const f = resolveFieldRef(fields, a.field ?? '')
    assertAggregatable(f, a.fn)
    const fnSql =
      a.fn === 'sum' ? sql`sum` : a.fn === 'avg' ? sql`avg` : a.fn === 'min' ? sql`min` : sql`max`
    return sql`${fnSql}(${typedExpr(f)}) AS ${sql.identifier(alias)}`
  })
  return { items: sql.join(items, sql`, `), names }
}
