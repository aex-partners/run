import { Json, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { InsertRecord } from '@/contexts/data/application/ports/in/InsertRecord'

export const insertRecordTool = (uc: InsertRecord): ToolDefinition => ({
  name: 'insert_record',
  readOnly: false,
  description: 'Insert a record into an entity. Input: { entityId, data }.',
  async execute(input: Json) {
    if (!isJsonObject(input)) return fail('insert_record: expected an object')
    const entityId = input.entityId
    const data = input.data
    if (typeof entityId !== 'string' || data === undefined || !isJsonObject(data)) {
      return fail('insert_record: expected { entityId: string, data: object }')
    }
    const r = await uc.execute({ entityId, data })
    return r.ok ? ok({ id: r.value.id, version: r.value.version }) : fail(r.error)
  },
})
