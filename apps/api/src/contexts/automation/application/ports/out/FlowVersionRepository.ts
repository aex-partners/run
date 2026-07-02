import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'

// Driven port for `flow_versions`. Covers the lookups the version use cases need:
// the single editable draft, a version scoped to its flow (publish/restore
// guard), and the latest version (execute fallback).
export interface FlowVersionRepository {
  nextId(): FlowVersionId
  findById(id: FlowVersionId): Promise<FlowVersion | null>
  // A version, but only if it belongs to `flowId` (prevents cross-flow promotion).
  findByIdForFlow(id: FlowVersionId, flowId: FlowId): Promise<FlowVersion | null>
  findDraft(flowId: FlowId): Promise<FlowVersion | null>
  findLatest(flowId: FlowId): Promise<FlowVersion | null>
  listForFlow(flowId: FlowId): Promise<FlowVersion[]>
  save(version: FlowVersion): Promise<void>
  deleteDrafts(flowId: FlowId): Promise<void>
}
