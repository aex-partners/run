import { Identifier } from '@/shared/kernel/Identifier'

export class FormId extends Identifier {
  static of(value: string): FormId {
    return new FormId(value)
  }
}
