import { Json, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { QueryKnowledge } from '@/contexts/knowledge/application/ports/in/QueryKnowledge'

// Driving adapter for the AI. Same in-port the HTTP layer uses; only the
// transport differs. Read-only -> auto-executes (no human confirmation). It
// formats the entries into the text block AEX returns to the model.
export const queryKnowledgeTool = (uc: QueryKnowledge, userId: string): ToolDefinition => ({
  name: 'query_knowledge',
  readOnly: true,
  description:
    'Search persistent memory for previously saved knowledge. Returns matching entries from company-wide and personal knowledge. Input: { query?: string, category?: string }.',
  async execute(input: Json) {
    if (!isJsonObject(input)) return fail('query_knowledge: expected an object')
    const query = typeof input.query === 'string' ? input.query : undefined
    const category = typeof input.category === 'string' ? input.category : undefined

    const entries = await uc.execute({ requestedBy: userId, query, category })
    if (entries.length === 0) {
      return ok({ text: 'No knowledge entries found.' })
    }

    const text = entries
      .map((e) => `[${e.scope}/${e.category}] ${e.title}\n${e.content}`)
      .join('\n\n---\n\n')
    return ok({ text })
  },
})
