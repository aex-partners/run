// Wiring for the `knowledge` context (RAG over knowledge entries + vectors). No
// cross-context construction-time dependencies. Exposes its query/command in-ports
// for the AI ToolBox plus the repo/embeddings/vector handles the files context
// reuses to index uploaded files (IndexFile lives in knowledge; the files worker
// drives it through these).
import { Infra } from '@/main/wiring/infra'

import { DrizzleKnowledgeRepository } from '@/contexts/knowledge/adapters/out/persistence/DrizzleKnowledgeRepository'
import { DrizzleVectorStore } from '@/contexts/knowledge/adapters/out/persistence/DrizzleVectorStore'
import { VoyageEmbeddingGateway } from '@/contexts/knowledge/adapters/out/embedding/VoyageEmbeddingGateway'
import { CreateKnowledgeService } from '@/contexts/knowledge/application/use-cases/CreateKnowledgeService'
import { UpdateKnowledgeService } from '@/contexts/knowledge/application/use-cases/UpdateKnowledgeService'
import { DeleteKnowledgeService } from '@/contexts/knowledge/application/use-cases/DeleteKnowledgeService'
import { ListKnowledgeQuery } from '@/contexts/knowledge/application/queries/ListKnowledgeQuery'
import { QueryKnowledgeQuery } from '@/contexts/knowledge/application/queries/QueryKnowledgeQuery'
import { SearchKnowledgeQuery } from '@/contexts/knowledge/application/queries/SearchKnowledgeQuery'
import { GetKnowledgeQuery } from '@/contexts/knowledge/application/queries/GetKnowledgeQuery'
import { ListCategoriesQuery } from '@/contexts/knowledge/application/queries/ListCategoriesQuery'
import { knowledgeController } from '@/contexts/knowledge/adapters/in/http/KnowledgeController'

export function wireKnowledge(infra: Infra) {
  const { db, events, clock, env } = infra

  const knowledgeRepo = new DrizzleKnowledgeRepository(db)
  const vectorStore = new DrizzleVectorStore(db)
  const embeddings = new VoyageEmbeddingGateway(env.ANTHROPIC_API_KEY ?? '')
  const createKnowledge = new CreateKnowledgeService(knowledgeRepo, embeddings, vectorStore, events, clock)
  const updateKnowledge = new UpdateKnowledgeService(knowledgeRepo, embeddings, vectorStore, events, clock)
  const deleteKnowledge = new DeleteKnowledgeService(knowledgeRepo, events, clock)
  const listKnowledge = new ListKnowledgeQuery(knowledgeRepo)
  const queryKnowledge = new QueryKnowledgeQuery(knowledgeRepo, embeddings, vectorStore)
  const searchKnowledge = new SearchKnowledgeQuery(knowledgeRepo, embeddings, vectorStore)
  const getKnowledge = new GetKnowledgeQuery(knowledgeRepo)
  const listCategories = new ListCategoriesQuery(knowledgeRepo)
  const knowledgeCtl = knowledgeController({
    create: createKnowledge, update: updateKnowledge, remove: deleteKnowledge,
    list: listKnowledge, get: getKnowledge, search: searchKnowledge, categories: listCategories,
  })

  return {
    controller: knowledgeCtl,
    ports: { createKnowledge, queryKnowledge, deleteKnowledge },
    indexing: { knowledgeRepo, embeddings, vectorStore },
  }
}

export type KnowledgeWiring = ReturnType<typeof wireKnowledge>
