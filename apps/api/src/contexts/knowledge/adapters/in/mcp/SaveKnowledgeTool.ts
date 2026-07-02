import { Json, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { CreateKnowledge } from '@/contexts/knowledge/application/ports/in/CreateKnowledge'

// Mutating -> requires confirmation (readOnly: false). Wraps the SAME
// CreateKnowledge in-port the HTTP controller uses.
export const saveKnowledgeTool = (uc: CreateKnowledge, userId: string): ToolDefinition => ({
  name: 'save_knowledge',
  readOnly: false,
  description:
    'Save a piece of knowledge to persistent memory. scope "company" is visible to all users; scope "personal" only to this user. Input: { scope: "company"|"personal", category, title, content }.',
  async execute(input: Json) {
    if (!isJsonObject(input)) return fail('save_knowledge: expected an object')
    const { scope, category, title, content } = input
    if (
      typeof scope !== 'string' ||
      typeof category !== 'string' ||
      typeof title !== 'string' ||
      typeof content !== 'string'
    ) {
      return fail('save_knowledge: expected { scope, category, title, content } as strings')
    }

    const r = await uc.execute({ scope, category, title, content, createdBy: userId })
    return r.ok ? ok({ id: r.value.id, title }) : fail(r.error)
  },
})
