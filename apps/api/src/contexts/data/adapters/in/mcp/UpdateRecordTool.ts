import { Json, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { UpdateRecord } from '@/contexts/data/application/ports/in/UpdateRecord'

// Mutating tool. Mirrors AEX's update_record but follows the kept domain model:
// a full-object write guarded by an explicit version CAS (expectedVersion),
// rather than a partial field merge.
export const updateRecordTool = (uc: UpdateRecord): ToolDefinition => ({
  name: 'update_record',
  readOnly: false,
  description:
    'Update an existing record. Input: { recordId, data, expectedVersion }. The write replaces the record data and only succeeds if expectedVersion matches the current version.',
  async execute(input: Json) {
    if (!isJsonObject(input)) return fail('update_record: expected an object')
    const recordId = input.recordId
    const data = input.data
    const expectedVersion = input.expectedVersion
    if (
      typeof recordId !== 'string' ||
      data === undefined ||
      !isJsonObject(data) ||
      typeof expectedVersion !== 'number'
    ) {
      return fail('update_record: expected { recordId: string, data: object, expectedVersion: number }')
    }
    const r = await uc.execute({ recordId, data, expectedVersion })
    return r.ok ? ok({ version: r.value.version }) : fail(r.error)
  },
})
