import { sql } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { ListEntities, EntitySummary } from '@/contexts/data/application/queries/ListEntities'
import { AexField } from '@/contexts/data/application/mappers/AexFieldCodec'

// Read-side adapter. Ports entities.list: every entity with its record count,
// most-recent first.
export class DrizzleListEntities implements ListEntities {
  constructor(private readonly db: Database) {}

  async execute(): Promise<EntitySummary[]> {
    const rows = (await this.db.execute(sql`
      SELECT e.*, (SELECT COUNT(*) FROM entity_records WHERE entity_id = e.id) AS record_count
      FROM entities e ORDER BY e.created_at DESC
    `)) as unknown as Record<string, unknown>[]

    return rows.map((row) => {
      let fields: AexField[] = []
      try {
        fields = JSON.parse((row.fields as string) ?? '[]') as AexField[]
      } catch {
        fields = []
      }
      return {
        id: row.id as string,
        name: row.name as string,
        slug: row.slug as string,
        description: (row.description as string | null) ?? null,
        fields: fields.map((f) => ({ name: f.name, slug: f.slug, type: f.type })),
        recordCount: Number(row.record_count) || 0,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }
    })
  }
}
