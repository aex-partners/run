import { Json, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { DeleteRecord } from '@/contexts/data/application/ports/in/DeleteRecord'

// Mutating tool. Mirrors AEX's delete_record.
export const deleteRecordTool = (uc: DeleteRecord): ToolDefinition => ({
  name: 'delete_record',
  readOnly: false,
  description: 'Delete a record permanently. Input: { recordId }.',
  async execute(input: Json) {
    if (!isJsonObject(input) || typeof input.recordId !== 'string') {
      return fail('delete_record: expected { recordId: string }')
    }
    const r = await uc.execute({ recordId: input.recordId })
    return r.ok ? ok({ success: true }) : fail(r.error)
  },
})
