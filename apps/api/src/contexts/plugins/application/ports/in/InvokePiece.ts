import { Json } from '@/shared/domain/Json'
import { Result } from '@/shared/kernel/Result'

// Driving port of the plugins context. automation reaches this only via its
// PieceGateway ACL, wired in main — never by importing this file directly.
export interface InvokePieceCommand {
  pieceId: string
  action: string
  input: Json
}

export interface InvokePiece {
  execute(cmd: InvokePieceCommand): Promise<Result<Json>>
}
