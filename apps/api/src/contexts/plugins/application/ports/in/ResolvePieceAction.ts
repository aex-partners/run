import { Json, JsonObject } from '@/shared/domain/Json'
import { Result } from '@/shared/kernel/Result'

// Driving port consumed by OTHER contexts via an ACL in main: automation's
// PieceGateway routes flow piece-steps here, and the assistant's piece MCP tools
// invoke it. Source `pieces/invoke-piece-action.ts` (invokePieceAction): loads the
// piece, resolves the credential (out via the ResolveCredential ACL), applies the
// auth gate, and runs the action. The richer sibling of the existing InvokePiece
// in-port (which stays wired to the StubPieceClient for the demo).
export interface ResolvePieceActionCommand {
  pieceName: string
  actionName: string
  input: JsonObject
  // Optional explicit credential; otherwise the plugin's primary/active one.
  credentialId?: string
  // Invoking user; reserved for auditing/scoping of side effects.
  userId?: string
}

export interface ResolvePieceAction {
  execute(cmd: ResolvePieceActionCommand): Promise<Result<Json>>
}
