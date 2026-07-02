import { Identifier } from '@/shared/kernel/Identifier'

export class KnowledgeId extends Identifier {
  static of(value: string): KnowledgeId {
    return new KnowledgeId(value)
  }
}
