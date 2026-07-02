import { Identifier } from '@/shared/kernel/Identifier'

export class ReminderId extends Identifier {
  static of(value: string): ReminderId {
    return new ReminderId(value)
  }
}
