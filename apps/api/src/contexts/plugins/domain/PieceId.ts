import { Identifier } from '@/shared/kernel/Identifier'

export class PieceId extends Identifier {
  static of(value: string): PieceId {
    return new PieceId(value)
  }
}
