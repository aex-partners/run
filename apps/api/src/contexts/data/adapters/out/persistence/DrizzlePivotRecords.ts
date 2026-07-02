import { sql, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { entities, entityRecords } from '@/platform/db/schema'
import { PivotRecords, PivotRecordsOptions, PivotResult } from '@/contexts/data/application/queries/PivotRecords'
import { DrizzleEntityMapper } from '@/contexts/data/adapters/out/persistence/DrizzleEntityMapper'

const CAP = 50000

// Read-side adapter. Ports entities.pivotData: lean per-slug extraction over the
// whole (capped) dataset; the client aggregates locally.
export class DrizzlePivotRecords implements PivotRecords {
  constructor(private readonly db: Database) {}

  async execute(opts: PivotRecordsOptions): Promise<PivotResult> {
    const [entityRow] = await this.db
      .select()
      .from(entities)
      .where(eq(entities.id, opts.entityId))
      .limit(1)
    if (!entityRow) throw new Error('Entity not found')

    const validSlugs = new Set(DrizzleEntityMapper.toDomain(entityRow).fields().map((f) => f.name.value))
    const slugs = [...new Set(opts.fields)].filter((s) => validSlugs.has(s))
    if (slugs.length === 0) return { rows: [], total: 0, truncated: false }

    const countRows = (await this.db.execute(
      sql`SELECT COUNT(*)::int AS count FROM entity_records WHERE entity_id = ${opts.entityId}`,
    )) as unknown as { count: number }[]
    const total = Number(countRows[0]?.count) || 0

    const cols = slugs.map(
      (slug, i) => sql`(${entityRecords.data}::jsonb ->> ${slug}) AS ${sql.identifier('k' + i)}`,
    )
    const raw = (await this.db.execute(sql`
      SELECT ${sql.join(cols, sql`, `)}
      FROM entity_records
      WHERE entity_id = ${opts.entityId}
      LIMIT ${CAP}
    `)) as unknown as Record<string, string | null>[]

    const rows = raw.map((r) => {
      const out: { [slug: string]: string | null } = {}
      slugs.forEach((slug, i) => {
        out[slug] = r['k' + i] ?? null
      })
      return out
    })

    return { rows, total, truncated: total > CAP }
  }
}
