import { FlowVersion, FlowVersionState } from '@/contexts/automation/domain/FlowVersion'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'

export interface FlowVersionRow {
  id: string
  flowId: string
  displayName: string
  trigger: string
  state: FlowVersionState
  valid: boolean
  schemaVersion: string | null
  createdAt: Date
  updatedAt: Date
}

export const FlowVersionMapper = {
  toPersistence(version: FlowVersion): FlowVersionRow {
    return {
      id: version.id.value,
      flowId: version.flowId.value,
      displayName: version.displayName,
      trigger: version.triggerRaw,
      state: version.state,
      valid: version.valid,
      schemaVersion: version.schemaVersion,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
    }
  },

  toDomain(row: FlowVersionRow): FlowVersion {
    return FlowVersion.rehydrate({
      id: FlowVersionId.of(row.id),
      flowId: FlowId.of(row.flowId),
      displayName: row.displayName,
      triggerRaw: row.trigger,
      state: row.state,
      valid: row.valid,
      schemaVersion: row.schemaVersion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  },
}
