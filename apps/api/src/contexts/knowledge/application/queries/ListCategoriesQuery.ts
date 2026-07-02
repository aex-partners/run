import { ListCategories } from '@/contexts/knowledge/application/queries/ListCategories'
import { KnowledgeRepository } from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'

export class ListCategoriesQuery implements ListCategories {
  constructor(private readonly repo: KnowledgeRepository) {}

  execute(): Promise<string[]> {
    return this.repo.listCategories()
  }
}
