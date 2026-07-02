import { Result, fail } from '@/shared/kernel/Result'
import { Json } from '@/shared/domain/Json'
import {
  ResolvePieceAction,
  ResolvePieceActionCommand,
} from '@/contexts/plugins/application/ports/in/ResolvePieceAction'
import { PieceRegistry } from '@/contexts/plugins/application/ports/out/PieceRegistry'
import { PieceClient } from '@/contexts/plugins/application/ports/out/PieceClient'
import { ResolveCredential } from '@/contexts/plugins/application/ports/out/ResolveCredential'
import { PieceMetadata } from '@/contexts/plugins/domain/PieceMetadata'

// Application service behind the ResolvePieceAction in-port. The single
// piece-invocation primitive (source `pieces/invoke-piece-action.ts`): load the
// piece metadata (registry), find the action, resolve the credential (out via the
// ResolveCredential ACL to the credentials context), apply the auth gate, then run
// the action (PieceClient). Credential resolution + the auth gate live HERE, in
// exactly one place, so automation's PieceGateway and the assistant's piece tools
// never duplicate them.
export class ResolvePieceActionService implements ResolvePieceAction {
  constructor(
    private readonly registry: PieceRegistry,
    private readonly credentials: ResolveCredential,
    private readonly client: PieceClient,
  ) {}

  async execute(cmd: ResolvePieceActionCommand): Promise<Result<Json>> {
    const meta = await this.registry.loadMetadata(cmd.pieceName)
    if (!meta) return fail(`Piece "${cmd.pieceName}" not found or not installed`)

    const action = PieceMetadata.findAction(meta, cmd.actionName)
    if (!action) return fail(`Action "${cmd.actionName}" not found in piece "${cmd.pieceName}"`)

    const resolved = await this.credentials.resolve({
      pluginName: cmd.pieceName,
      credentialId: cmd.credentialId,
    })
    if (!resolved.ok) return fail(resolved.error)
    const auth = resolved.value

    // Auth gate: fail fast before running anything that needs a credential. Only
    // fail when the piece actually declares auth AND the action requires it AND no
    // credential resolved, so no-auth pieces (e.g. http) do not regress.
    if (meta.hasAuth && action.requireAuth && auth == null) {
      return fail(
        `Action "${cmd.actionName}" in piece "${cmd.pieceName}" requires a credential but none is configured`,
      )
    }

    return this.client.call({
      pieceId: cmd.pieceName,
      action: cmd.actionName,
      input: cmd.input,
      auth,
      credentialId: cmd.credentialId,
      userId: cmd.userId,
    })
  }
}
