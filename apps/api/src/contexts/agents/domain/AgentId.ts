import { Identifier } from '@/shared/kernel/Identifier'

export class AgentId extends Identifier {
  static of(value: string): AgentId {
    return new AgentId(value)
  }
}
