import { Json, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { QueryRecords, QueryRecordsSpec } from '@/contexts/data/application/queries/QueryRecords'

// Read-only tool. Mirrors AEX's `query`: filter, aggregate, group, sort,
// paginate over an entity's records. The query spec is forwarded to the
// read-side adapter (the dynamic query engine).
export const queryTool = (q: QueryRecords): ToolDefinition => ({
  name: 'query',
  readOnly: true,
  description:
    'Query records from an entity with filtering (where), aggregation (aggregate), grouping (group_by), sorting (order_by), and pagination (limit/offset). Input mirrors the AEX query tool; call describe_entity first to learn field slugs.',
  async execute(input: Json) {
    if (!isJsonObject(input) || typeof input.entity !== 'string') {
      return fail('query: expected { entity: string, ... }')
    }
    try {
      const result = await q.execute(input as unknown as QueryRecordsSpec)
      return ok(result as unknown as Json)
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err))
    }
  },
})
