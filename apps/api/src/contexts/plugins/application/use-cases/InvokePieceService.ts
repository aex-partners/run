import { Result, fail } from '@/shared/kernel/Result'
import { Json } from '@/shared/domain/Json'
import { InvokePiece, InvokePieceCommand } from '@/contexts/plugins/application/ports/in/InvokePiece'
import { PieceClient } from '@/contexts/plugins/application/ports/out/PieceClient'

export class InvokePieceService implements InvokePiece {
  constructor(private readonly client: PieceClient) {}

  async execute(cmd: InvokePieceCommand): Promise<Result<Json>> {
    if (!cmd.pieceId || !cmd.action) return fail('InvokePiece: pieceId and action are required')
    return this.client.call(cmd)
  }
}
