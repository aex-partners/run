import { randomUUID } from 'node:crypto'
import { FlowVersionRepository } from '@/contexts/automation/application/ports/out/FlowVersionRepository'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'

// In-memory test double for `flow_versions`.
export class InMemoryFlowVersionRepository implements FlowVersionRepository {
  private readonly versions = new Map<string, FlowVersion>()

  nextId(): FlowVersionId {
    return FlowVersionId.of(randomUUID())
  }

  async findById(id: FlowVersionId): Promise<FlowVersion | null> {
    return this.versions.get(id.value) ?? null
  }

  async findByIdForFlow(id: FlowVersionId, flowId: FlowId): Promise<FlowVersion | null> {
    const v = this.versions.get(id.value)
    return v && v.flowId.value === flowId.value ? v : null
  }

  async findDraft(flowId: FlowId): Promise<FlowVersion | null> {
    return this.forFlow(flowId).find((v) => v.isDraft()) ?? null
  }

  async findLatest(flowId: FlowId): Promise<FlowVersion | null> {
    return this.forFlow(flowId)[0] ?? null
  }

  async listForFlow(flowId: FlowId): Promise<FlowVersion[]> {
    return this.forFlow(flowId)
  }

  async save(version: FlowVersion): Promise<void> {
    this.versions.set(version.id.value, version)
  }

  async deleteDrafts(flowId: FlowId): Promise<void> {
    for (const [id, v] of this.versions) {
      if (v.flowId.value === flowId.value && v.isDraft()) this.versions.delete(id)
    }
  }

  // Newest-first, mirroring the SQL `orderBy(desc(createdAt))`.
  private forFlow(flowId: FlowId): FlowVersion[] {
    return [...this.versions.values()]
      .filter((v) => v.flowId.value === flowId.value)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }
}
