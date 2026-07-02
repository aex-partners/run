import { ListKnowledge, ListKnowledgeInput } from '@/contexts/knowledge/application/ports/in/ListKnowledge'
import { KnowledgeView } from '@/contexts/knowledge/application/queries/KnowledgeView'
import { KnowledgeRepository } from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'

// Read service. Pure pass-through to the read store with the default policy:
// hide file-content, apply scope visibility, page the results.
export class ListKnowledgeQuery implements ListKnowledge {
  constructor(private readonly repo: KnowledgeRepository) {}

  execute(input: ListKnowledgeInput): Promise<KnowledgeView[]> {
    return this.repo.list({
      requesterId: input.requestedBy,
      scope: input.scope,
      category: input.category,
      excludeFileContent: true,
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
    })
  }
}
