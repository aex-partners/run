import { Json, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { DescribeEntity } from '@/contexts/data/application/ports/in/DescribeEntity'

// Read-only tool. Mirrors AEX's describe_entity: field slugs, types, options,
// relationships, descriptions. Resolves the entity by slug, name, or id.
export const describeEntityTool = (uc: DescribeEntity): ToolDefinition => ({
  name: 'describe_entity',
  readOnly: true,
  description:
    "Describe an entity's schema (field slugs, types, options, relationships). Input: { entity }. Call before query to learn the field slugs.",
  async execute(input: Json) {
    if (!isJsonObject(input) || typeof input.entity !== 'string') {
      return fail('describe_entity: expected { entity: string }')
    }
    const result = await uc.execute(input.entity)
    if (!result) return fail(`describe_entity: entity "${input.entity}" not found`)
    return ok(result as unknown as Json)
  },
})
