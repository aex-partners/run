import { Flow, FlowStatus } from '@/contexts/automation/domain/FlowAggregate'
import { FlowId } from '@/contexts/automation/domain/ids'

// The on-disk shape of a `flows` row. The mapper is the only place that knows it.
export interface FlowRow {
  id: string
  status: FlowStatus
  folderId: string | null
  publishedVersionId: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export const FlowMapper = {
  toPersistence(flow: Flow): FlowRow {
    return {
      id: flow.id.value,
      status: flow.status,
      folderId: flow.folderId,
      publishedVersionId: flow.publishedVersionId,
      createdBy: flow.createdBy,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
    }
  },

  toDomain(row: FlowRow): Flow {
    return Flow.rehydrate({
      id: FlowId.of(row.id),
      status: row.status,
      folderId: row.folderId,
      publishedVersionId: row.publishedVersionId,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  },
}
