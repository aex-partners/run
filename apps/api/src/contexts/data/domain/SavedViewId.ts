import { Identifier } from '@/shared/kernel/Identifier'

export class SavedViewId extends Identifier {
  static of(value: string): SavedViewId {
    return new SavedViewId(value)
  }
}
