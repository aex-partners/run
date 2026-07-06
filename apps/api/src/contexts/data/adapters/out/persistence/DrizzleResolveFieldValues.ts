import { and, eq, inArray } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { entities, entityRecords } from '@/platform/db/schema'
import {
  ResolveFieldValues,
  ResolveFieldValuesInput,
  ResolveFieldValuesResult,
  FieldValuePair,
} from '@/contexts/data/application/queries/ResolveFieldValues'
import { Json } from '@/shared/domain/Json'
import { DrizzleEntityMapper } from '@/contexts/data/adapters/out/persistence/DrizzleEntityMapper'

// Read-side adapter. Batch-resolves record ids -> the value of ONE field, in a
// single SQL round-trip (id = ANY(ids)). Mirrors DrizzleResolveLabels, but for an
// arbitrary field instead of the title. `fieldSlug` may be the field's slug (JSON
// key) OR its id — a lookup's `lookupFieldId` config can carry either, so the
// entity's fields are read to resolve the actual JSON key. Skips ids with no
// matching record or an empty value.
export class DrizzleResolveFieldValues implements ResolveFieldValues {
  constructor(private readonly db: Database) {}

  async execute(input: ResolveFieldValuesInput): Promise<ResolveFieldValuesResult> {
    const ids = [...new Set(input.ids)].filter((id) => id !== '')
    if (ids.length === 0 || !input.fieldSlug) return { values: [] }

    const [entityRow] = await this.db
      .select()
      .from(entities)
      .where(eq(entities.id, input.entityId))
      .limit(1)
    if (!entityRow) return { values: [] }

    // Resolve the JSON key: match by slug first, then by field id, falling back to
    // the raw ref when nothing matches (an unknown key just resolves to no values).
    const fields = DrizzleEntityMapper.toDomain(entityRow).fields()
    const match = fields.find((f) => f.name.value === input.fieldSlug || f.meta.id === input.fieldSlug)
    const slug = match ? match.name.value : input.fieldSlug

    const rows = await this.db
      .select({ id: entityRecords.id, data: entityRecords.data })
      .from(entityRecords)
      .where(and(eq(entityRecords.entityId, input.entityId), inArray(entityRecords.id, ids)))

    const values: FieldValuePair[] = []
    for (const r of rows) {
      let raw: Json | undefined
      try {
        raw = (JSON.parse(r.data) as Record<string, Json>)[slug]
      } catch {
        raw = undefined
      }
      if (raw === undefined || raw === null || raw === '') continue
      values.push({ id: r.id, value: raw })
    }
    return { values }
  }
}
