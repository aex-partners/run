import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { SaveVersion, SaveVersionCommand } from '@/contexts/automation/application/ports/in/SaveVersion'
import { FlowVersionRepository } from '@/contexts/automation/application/ports/out/FlowVersionRepository'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowId } from '@/contexts/automation/domain/ids'
import { FlowTrigger } from '@/contexts/automation/domain/FlowDsl'
import { validateFlowVersion } from '@/contexts/automation/domain/FlowValidator'

// `flows.saveVersion`: upsert the single editable draft. Validity is computed in
// save mode (an empty trigger is only a warning, so drafts can be incomplete).
export class SaveVersionService implements SaveVersion {
  constructor(
    private readonly versions: FlowVersionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: SaveVersionCommand): Promise<Result<{ versionId: string }>> {
    let trigger: FlowTrigger
    try {
      trigger = JSON.parse(cmd.trigger) as FlowTrigger
    } catch {
      return fail('SaveVersion: trigger is not valid JSON')
    }

    const { valid } = validateFlowVersion(trigger)
    const now = this.clock.now()
    const flowId = FlowId.of(cmd.flowId)

    const existing = await this.versions.findDraft(flowId)
    if (existing) {
      const r = existing.updateDraft({ displayName: cmd.displayName, triggerRaw: cmd.trigger, valid, now })
      if (!r.ok) return fail(r.error)
      await this.versions.save(existing)
      return ok({ versionId: existing.id.value })
    }

    const version = FlowVersion.createDraft({
      id: this.versions.nextId(),
      flowId,
      displayName: cmd.displayName,
      triggerRaw: cmd.trigger,
      valid,
      now,
    })
    await this.versions.save(version)
    return ok({ versionId: version.id.value })
  }
}
