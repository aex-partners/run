import { Result, ok, fail } from '@/shared/kernel/Result'
import { Json, JsonObject } from '@/shared/domain/Json'
import {
  InvokePieceTrigger,
  InvokePieceTriggerCommand,
} from '@/contexts/plugins/application/ports/in/InvokePieceTrigger'
import { PieceRegistry } from '@/contexts/plugins/application/ports/out/PieceRegistry'
import { PieceClient } from '@/contexts/plugins/application/ports/out/PieceClient'
import { PieceMetadata } from '@/contexts/plugins/domain/PieceMetadata'

// Application service behind the InvokePieceTrigger in-port. The single
// piece-trigger-invocation primitive (source `pieces/invoke-piece-trigger.ts`):
// load the piece metadata (registry), find the trigger, then dispatch one
// lifecycle hook through the PieceClient. The client owns credential resolution
// and the impure framework dispatch; this layer stays pure and depends ONLY on
// ports. `run` surfaces the emitted items; `onEnable`/`onDisable` surface the
// subscription descriptor so the lifecycle layer can (de)register a poll schedule.
export class InvokePieceTriggerService implements InvokePieceTrigger {
  constructor(
    private readonly registry: PieceRegistry,
    private readonly client: PieceClient,
  ) {}

  async execute(cmd: InvokePieceTriggerCommand): Promise<Result<Json>> {
    if (!cmd.pieceName || !cmd.triggerName) {
      return fail('InvokePieceTrigger: pieceName and triggerName are required')
    }

    const meta = await this.registry.loadMetadata(cmd.pieceName)
    if (!meta) return fail(`Piece "${cmd.pieceName}" not found or not installed`)

    const trigger = PieceMetadata.findTrigger(meta, cmd.triggerName)
    if (!trigger) {
      return fail(`Trigger "${cmd.triggerName}" not found in piece "${cmd.pieceName}"`)
    }

    const result = await this.client.callTrigger({
      pieceId: cmd.pieceName,
      triggerName: cmd.triggerName,
      hook: cmd.action,
      input: cmd.input,
      flowId: cmd.context.flowId,
      credentialId: cmd.context.credentialId,
      payload: cmd.context.payload,
      webhookUrl: cmd.context.webhookUrl,
    })
    if (!result.ok) return result

    // `run` returns the polled/dedup payload list verbatim.
    if (cmd.action === 'run') return ok(result.value.items)

    // onEnable/onDisable return the subscription descriptor (strategy + schedule).
    const descriptor: JsonObject = {}
    if (result.value.strategy !== undefined) descriptor.strategy = result.value.strategy
    if (result.value.scheduledCron !== undefined) descriptor.scheduledCron = result.value.scheduledCron
    if (result.value.scheduledTimezone !== undefined) {
      descriptor.scheduledTimezone = result.value.scheduledTimezone
    }
    return ok(descriptor)
  }
}
