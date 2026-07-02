import { Identifier } from '@/shared/kernel/Identifier'

export class RecordId extends Identifier {
  static of(value: string): RecordId {
    return new RecordId(value)
  }
}
