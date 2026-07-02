import { Json, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { CreateEntity } from '@/contexts/data/application/ports/in/CreateEntity'

// Driving adapter for the AI. It is the SAME in-port the HTTP controller calls;
// only the transport (an LLM tool call) differs. Mutating -> requires
// confirmation (readOnly: false).
export const createEntityTool = (uc: CreateEntity): ToolDefinition => ({
  name: 'create_entity',
  readOnly: false,
  description: 'Create a new entity (dynamic table) by name.',
  async execute(input: Json) {
    if (!isJsonObject(input) || typeof input.name !== 'string') {
      return fail('create_entity: expected { name: string }')
    }
    const r = await uc.execute({ name: input.name })
    return r.ok ? ok({ id: r.value.id }) : fail(r.error)
  },
})
