import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { entities } from '@/platform/db/schema'
import {
  ListOptions,
  ListOptionsInput,
  ListOptionsResult,
  OptionPair,
} from '@/contexts/data/application/queries/ListOptions'
import { Condition, QueryRecords } from '@/contexts/data/application/queries/QueryRecords'
import { DrizzleEntityMapper } from '@/contexts/data/adapters/out/persistence/DrizzleEntityMapper'
import { titleSlugFor } from '@/contexts/data/adapters/out/persistence/titleField'

const DEFAULT_LIMIT = 50

// Read-side adapter. Resolves the entity's title-field slug (shared with
// DrizzleResolveLabels), then reuses the dynamic query engine (QueryRecords) to
// read that entity's records — filtering by a `contains` (ILIKE) on the title when
// a search is given — and projects each row into an { value: id, label: title }
// picker option. Ids whose title is empty are skipped.
export class DrizzleListOptions implements ListOptions {
  constructor(
    private readonly db: Database,
    private readonly query: QueryRecords,
  ) {}

  async execute(input: ListOptionsInput): Promise<ListOptionsResult> {
    const limit = input.limit ?? DEFAULT_LIMIT

    const [entityRow] = await this.db
      .select()
      .from(entities)
      .where(eq(entities.id, input.entityId))
      .limit(1)
    if (!entityRow) return { options: [] }

    const fields = DrizzleEntityMapper.toDomain(entityRow).fields()
    const slug = titleSlugFor(entityRow.name, fields)
    if (!slug) return { options: [] }

    const search = input.search?.trim()
    const where: Condition[] | undefined = search
      ? [{ field: slug, op: 'contains', value: search }]
      : undefined

    const result = await this.query.execute({
      entity: input.entityId,
      where,
      order_by: [{ field: slug, dir: 'asc' }],
      limit,
    })
    if (!('rows' in result)) return { options: [] }

    const options: OptionPair[] = []
    for (const r of result.rows) {
      const raw = r.data[slug]
      if (raw === undefined || raw === null || raw === '') continue
      options.push({ value: r.id, label: String(raw) })
    }
    return { options }
  }
}
