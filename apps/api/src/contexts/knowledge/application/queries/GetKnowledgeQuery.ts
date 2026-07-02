import { GetKnowledge, GetKnowledgeInput } from '@/contexts/knowledge/application/queries/GetKnowledge'
import { KnowledgeView } from '@/contexts/knowledge/application/queries/KnowledgeView'
import { KnowledgeRepository } from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'

export class GetKnowledgeQuery implements GetKnowledge {
  constructor(private readonly repo: KnowledgeRepository) {}

  execute(input: GetKnowledgeInput): Promise<KnowledgeView | null> {
    return this.repo.view(KnowledgeId.of(input.id), input.requestedBy)
  }
}
