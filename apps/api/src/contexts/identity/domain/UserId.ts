import { Identifier } from '@/shared/kernel/Identifier'

export class UserId extends Identifier {
  static of(value: string): UserId {
    return new UserId(value)
  }
}
