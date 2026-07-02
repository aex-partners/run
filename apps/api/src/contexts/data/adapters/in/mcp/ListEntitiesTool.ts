import { Json } from '@/shared/domain/Json'
import { ok } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { ListEntities } from '@/contexts/data/application/queries/ListEntities'

// Read-only tool. Mirrors AEX's list_entities.
export const listEntitiesTool = (q: ListEntities): ToolDefinition => ({
  name: 'list_entities',
  readOnly: true,
  description: 'List all data entities (tables): id, name, slug, fields, and record counts.',
  async execute(_input: Json) {
    const entities = await q.execute()
    return ok(entities as unknown as Json)
  },
})
