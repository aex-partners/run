import { describe, it, expect, vi } from 'vitest'
import { IndexFileService } from '@/contexts/knowledge/application/use-cases/IndexFileService'
import { KnowledgeRepository } from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'
import { EmbeddingGateway } from '@/contexts/knowledge/application/ports/out/EmbeddingGateway'
import { VectorStore } from '@/contexts/knowledge/application/ports/out/VectorStore'
import { Knowledge } from '@/contexts/knowledge/domain/Knowledge'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'
import { Category } from '@/contexts/knowledge/domain/Category'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

function fileKnowledge(id: string, fileId: string): Knowledge {
  const r = Knowledge.create(
    KnowledgeId.of(id),
    {
      scope: 'company',
      category: Category.FILE_CONTENT,
      title: 'old.pdf',
      content: 'old text',
      createdBy: null,
      sourceFileId: fileId,
    },
    NOW,
  )
  if (!r.ok) throw new Error('setup failed')
  r.value.pullEvents()
  return r.value
}

class FakeRepo implements KnowledgeRepository {
  saved: Knowledge[] = []
  constructor(private readonly bySource: Map<string, Knowledge> = new Map()) {}
  nextId(): KnowledgeId {
    return KnowledgeId.of('k-new')
  }
  async findById(): Promise<Knowledge | null> {
    return null
  }
  async findBySourceFileId(fileId: string): Promise<Knowledge | null> {
    return this.bySource.get(fileId) ?? null
  }
  async save(k: Knowledge): Promise<void> {
    this.saved.push(k)
  }
  async delete(): Promise<void> {}
  async list(): Promise<never[]> {
    return []
  }
  async view(): Promise<null> {
    return null
  }
  async textSearch(): Promise<never[]> {
    return []
  }
  async listCategories(): Promise<string[]> {
    return []
  }
}

class FakeEmbeddings implements EmbeddingGateway {
  calls = 0
  constructor(private readonly doc: number[] | null | Error = [1, 2, 3]) {}
  async embedDocument(): Promise<number[] | null> {
    this.calls++
    if (this.doc instanceof Error) throw this.doc
    return this.doc
  }
  async embedQuery(): Promise<number[] | null> {
    return null
  }
}

class FakeVectors implements VectorStore {
  savedEmbeddings: string[] = []
  async saveEmbedding(id: KnowledgeId): Promise<void> {
    this.savedEmbeddings.push(id.value)
  }
  async search(): Promise<never[]> {
    return []
  }
}

class FakeEvents {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

const cmd = { fileId: 'file-1', fileName: 'report.pdf', mimeType: 'application/pdf', text: 'hello world' }

describe('IndexFileService', () => {
  it('first index: creates a company file-content row, publishes and embeds', async () => {
    const repo = new FakeRepo()
    const embeddings = new FakeEmbeddings()
    const vectors = new FakeVectors()
    const events = new FakeEvents()
    const svc = new IndexFileService(repo, embeddings, vectors, events, clock)

    const r = await svc.execute(cmd)

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ knowledgeId: 'k-new' })
    expect(repo.saved).toHaveLength(1)
    const saved = repo.saved[0]!
    expect(saved.scope.kind).toBe('company')
    expect(saved.category.value).toBe(Category.FILE_CONTENT)
    expect(saved.title).toBe('report.pdf')
    expect(saved.sourceFileId).toBe('file-1')
    expect(events.published.some((e) => e.name === 'knowledge.KnowledgeCreated')).toBe(true)
    expect(embeddings.calls).toBe(1)
    expect(vectors.savedEmbeddings).toEqual(['k-new'])
  })

  it('re-index: updates the existing row in place (same id) and re-embeds', async () => {
    const existing = fileKnowledge('k-existing', 'file-1')
    const repo = new FakeRepo(new Map([['file-1', existing]]))
    const embeddings = new FakeEmbeddings()
    const vectors = new FakeVectors()
    const events = new FakeEvents()
    const svc = new IndexFileService(repo, embeddings, vectors, events, clock)

    const r = await svc.execute({ ...cmd, fileName: 'report-v2.pdf', text: 'updated text' })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ knowledgeId: 'k-existing' })
    expect(repo.saved).toEqual([existing])
    expect(existing.title).toBe('report-v2.pdf')
    expect(existing.content).toBe('updated text')
    expect(events.published.some((e) => e.name === 'knowledge.KnowledgeUpdated')).toBe(true)
    expect(embeddings.calls).toBe(1)
    expect(vectors.savedEmbeddings).toEqual(['k-existing'])
  })

  it('swallows an embedding failure: the write still succeeds (best-effort)', async () => {
    const repo = new FakeRepo()
    const vectors = new FakeVectors()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const svc = new IndexFileService(repo, new FakeEmbeddings(new Error('voyage down')), vectors, new FakeEvents(), clock)

    const r = await svc.execute(cmd)

    expect(r.ok).toBe(true)
    expect(repo.saved).toHaveLength(1)
    expect(vectors.savedEmbeddings).toHaveLength(0)
    errSpy.mockRestore()
  })
})
