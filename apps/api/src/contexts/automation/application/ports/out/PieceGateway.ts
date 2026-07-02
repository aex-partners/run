import { Json } from '@/shared/domain/Json'
import { Result } from '@/shared/kernel/Result'

// ACL out-port. automation must NOT import the plugins context, so it declares
// WHAT it needs (invoke a piece action) and the composition root fulfills HOW
// (route to the plugins InvokePiece in-port).
export interface PieceGateway {
  invoke(call: { pieceId: string; action: string; input: Json; credentialId?: string }): Promise<Result<Json>>
}
