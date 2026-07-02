import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import {
  PublishVersion,
  PublishVersionCommand,
  PublishVersionError,
} from '@/contexts/automation/application/ports/in/PublishVersion'
import { FlowAggregateRepository } from '@/contexts/automation/application/ports/out/FlowAggregateRepository'
import { FlowVersionRepository } from '@/contexts/automation/application/ports/out/FlowVersionRepository'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'
import { validateFlowVersion } from '@/contexts/automation/domain/FlowValidator'

// `flows.publish`: validate in publish mode, lock the version, mark it published.
// The version is scoped to its flow so a versionId from a different flow can never
// be promoted (same guard as the source).
export class PublishVersionService implements PublishVersion {
  constructor(
    private readonly flows: FlowAggregateRepository,
    private readonly versions: FlowVersionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: PublishVersionCommand): Promise<Result<{ success: true }, PublishVersionError | string>> {
    const flowId = FlowId.of(cmd.flowId)
    const version = await this.versions.findByIdForFlow(FlowVersionId.of(cmd.versionId), flowId)
    if (!version) return fail('PublishVersion: version not found for this flow')

    const parsed = version.parseTrigger()
    if (!parsed.ok) return fail(parsed.error)

    const result = validateFlowVersion(parsed.value, { publish: true })
    if (!result.valid) {
      return fail<{ success: true }, PublishVersionError>({
        message: 'Flow is not valid and cannot be published.',
        errors: result.errors,
        warnings: result.warnings,
      })
    }

    const now = this.clock.now()
    version.lock(now)
    await this.versions.save(version)

    const flow = await this.flows.findById(flowId)
    if (!flow) return fail('PublishVersion: flow not found')
    flow.publish(version.id.value, now)
    await this.flows.save(flow)

    return ok({ success: true })
  }
}
