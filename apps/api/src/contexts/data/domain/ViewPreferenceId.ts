import { Identifier } from '@/shared/kernel/Identifier'

export class ViewPreferenceId extends Identifier {
  static of(value: string): ViewPreferenceId {
    return new ViewPreferenceId(value)
  }
}
