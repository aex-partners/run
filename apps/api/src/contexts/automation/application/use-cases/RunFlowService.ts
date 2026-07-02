import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { RunFlow, RunFlowCommand, RunFlowResult } from '@/contexts/automation/application/ports/in/RunFlow'
import { FlowRunRepository } from '@/contexts/automation/application/ports/out/FlowRunRepository'
import { FlowVersionRepository } from '@/contexts/automation/application/ports/out/FlowVersionRepository'
import { FlowEngineInterpreter } from '@/contexts/automation/application/use-cases/FlowEngineInterpreter'
import { FlowRunId } from '@/contexts/automation/domain/ids'

// The worker use case (ported from `flow-worker.ts`). Loads a pending/running run,
// runs its version through the engine interpreter, and persists the verdict. Idle
// for runs already terminal (returns `skipped`).
export class RunFlowService implements RunFlow {
  constructor(
    private readonly runs: FlowRunRepository,
    private readonly versions: FlowVersionRepository,
    private readonly interpreter: FlowEngineInterpreter,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: RunFlowCommand): Promise<Result<RunFlowResult>> {
    const run = await this.runs.findById(FlowRunId.of(cmd.runId))
    if (!run) return fail('RunFlow: run not found')
    if (!run.isRunnable()) return ok({ status: 'skipped' })

    if (!run.flowVersionId) return fail('RunFlow: run has no version')
    const version = await this.versions.findById(run.flowVersionId)
    if (!version) return fail('RunFlow: flow version not found')

    const parsed = version.parseTrigger()
    if (!parsed.ok) return fail(parsed.error)

    // Mark running before execution (covers the retry-from-pending case).
    run.start(this.clock.now())
    await this.runs.save(run)

    try {
      const state = await this.interpreter.run(parsed.value, cmd.runId, run.parseTriggerPayload())
      const stepsRaw = JSON.stringify(state.steps)
      const now = this.clock.now()

      if (state.status === 'succeeded') {
        run.succeed(stepsRaw, state.duration, now)
        await this.runs.save(run)
        return ok({ status: 'succeeded' })
      }

      const error = state.error ?? 'Flow execution failed'
      run.fail(error, { stepsRaw, duration: state.duration, now })
      await this.runs.save(run)
      return ok({ status: 'failed', error })
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Flow execution failed'
      run.fail(error, { now: this.clock.now() })
      await this.runs.save(run)
      return ok({ status: 'failed', error })
    }
  }
}
