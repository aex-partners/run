import { and, eq, inArray } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { entities, entityRecords } from '@/platform/db/schema'
import {
  ResolveLabels,
  ResolveLabelsInput,
  ResolveLabelsResult,
  LabelPair,
} from '@/contexts/data/application/queries/ResolveLabels'
import { DrizzleEntityMapper } from '@/contexts/data/adapters/out/persistence/DrizzleEntityMapper'
import { titleSlugFor } from '@/contexts/data/adapters/out/persistence/titleField'

// Read-side adapter. Batch-resolves record ids -> title-field values in a single
// SQL round-trip (id = ANY(ids)). Skips ids with no matching record or an empty
// title. Reads the entity's fields (via the mapper) to find the title slug.
export class DrizzleResolveLabels implements ResolveLabels {
  constructor(private readonly db: Database) {}

  async execute(input: ResolveLabelsInput): Promise<ResolveLabelsResult> {
    const ids = [...new Set(input.ids)].filter((id) => id !== '')
    if (ids.length === 0) return { labels: [] }

    const [entityRow] = await this.db
      .select()
      .from(entities)
      .where(eq(entities.id, input.entityId))
      .limit(1)
    if (!entityRow) return { labels: [] }

    const fields = DrizzleEntityMapper.toDomain(entityRow).fields()
    // Per-relation-field label: resolve the JSON key of `labelFieldId` (matched by
    // field id or slug). Falls back to the title heuristic when absent/unmatched.
    let slug: string | undefined
    if (input.labelFieldId) {
      const match = fields.find(
        (f) => f.meta.id === input.labelFieldId || f.name.value === input.labelFieldId,
      )
      slug = match?.name.value
    }
    if (!slug) slug = titleSlugFor(entityRow.name, fields)
    if (!slug) return { labels: [] }

    const rows = await this.db
      .select({ id: entityRecords.id, data: entityRecords.data })
      .from(entityRecords)
      .where(and(eq(entityRecords.entityId, input.entityId), inArray(entityRecords.id, ids)))

    const labels: LabelPair[] = []
    for (const r of rows) {
      let raw: unknown
      try {
        raw = (JSON.parse(r.data) as Record<string, unknown>)[slug]
      } catch {
        raw = undefined
      }
      if (raw === undefined || raw === null || raw === '') continue
      labels.push({ id: r.id, label: String(raw) })
    }
    return { labels }
  }
}
