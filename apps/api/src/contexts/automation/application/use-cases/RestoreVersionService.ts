import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { RestoreVersion, RestoreVersionCommand } from '@/contexts/automation/application/ports/in/RestoreVersion'
import { FlowAggregateRepository } from '@/contexts/automation/application/ports/out/FlowAggregateRepository'
import { FlowVersionRepository } from '@/contexts/automation/application/ports/out/FlowVersionRepository'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'

// `flows.restoreVersion`: clone a locked version into a fresh draft, replacing any
// existing draft. Only locked versions may be restored.
export class RestoreVersionService implements RestoreVersion {
  constructor(
    private readonly flows: FlowAggregateRepository,
    private readonly versions: FlowVersionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: RestoreVersionCommand): Promise<Result<{ versionId: string }>> {
    const flowId = FlowId.of(cmd.flowId)
    const flow = await this.flows.findById(flowId)
    if (!flow) return fail('RestoreVersion: flow not found')

    const source = await this.versions.findByIdForFlow(FlowVersionId.of(cmd.versionId), flowId)
    if (!source) return fail('RestoreVersion: version not found')
    if (!source.isLocked()) return fail('RestoreVersion: can only restore from a locked version')

    await this.versions.deleteDrafts(flowId)

    const now = this.clock.now()
    const draft = FlowVersion.createDraft({
      id: this.versions.nextId(),
      flowId,
      displayName: source.displayName,
      triggerRaw: source.triggerRaw,
      valid: false,
      schemaVersion: source.schemaVersion,
      now,
    })
    await this.versions.save(draft)
    return ok({ versionId: draft.id.value })
  }
}
