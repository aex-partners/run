import { Json, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { DeleteKnowledge } from '@/contexts/knowledge/application/ports/in/DeleteKnowledge'

// Mutating -> requires confirmation (readOnly: false). Authority is enforced by
// the aggregate via the in-port.
export const deleteKnowledgeTool = (uc: DeleteKnowledge, userId: string): ToolDefinition => ({
  name: 'delete_knowledge',
  readOnly: false,
  description:
    'Delete a knowledge entry by ID. Only the creator can delete personal entries; company entries can be deleted by any user. Input: { id: string }.',
  async execute(input: Json) {
    if (!isJsonObject(input) || typeof input.id !== 'string') {
      return fail('delete_knowledge: expected { id: string }')
    }
    const r = await uc.execute({ id: input.id, requestedBy: userId })
    return r.ok ? ok({ deleted: true }) : fail(r.error)
  },
})
