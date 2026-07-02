import { Identifier } from '@/shared/kernel/Identifier'

export class EntityId extends Identifier {
  static of(value: string): EntityId {
    return new EntityId(value)
  }
}
