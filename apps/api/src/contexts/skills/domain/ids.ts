import { Identifier } from '@/shared/kernel/Identifier'

export class SkillId extends Identifier {
  static of(value: string): SkillId {
    return new SkillId(value)
  }
}
