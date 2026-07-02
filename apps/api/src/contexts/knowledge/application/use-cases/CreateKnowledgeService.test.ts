import { describe, it, expect, vi } from 'vitest'
import { CreateKnowledgeService } from '@/contexts/knowledge/application/use-cases/CreateKnowledgeService'
import { KnowledgeRepository } from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'
import { EmbeddingGateway } from '@/contexts/knowledge/application/ports/out/EmbeddingGateway'
import { VectorStore } from '@/contexts/knowledge/application/ports/out/VectorStore'
import { Knowledge } from '@/contexts/knowledge/domain/Knowledge'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

class FakeRepo implements KnowledgeRepository {
  saved: Knowledge[] = []
  nextId(): KnowledgeId {
    return KnowledgeId.of('k-1')
  }
  async findById(): Promise<Knowledge | null> {
    return null
  }
  async findBySourceFileId(): Promise<Knowledge | null> {
    return null
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
  constructor(private readonly doc: number[] | null | Error = [0.1, 0.2]) {}
  async embedDocument(): Promise<number[] | null> {
    if (this.doc instanceof Error) throw this.doc
    return this.doc
  }
  async embedQuery(): Promise<number[] | null> {
    return null
  }
}

class FakeVectors implements VectorStore {
  savedEmbeddings: { id: string; embedding: number[] }[] = []
  async saveEmbedding(id: KnowledgeId, embedding: number[]): Promise<void> {
    this.savedEmbeddings.push({ id: id.value, embedding })
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

const cmd = {
  scope: 'company',
  category: 'company-info',
  title: 'Vacation policy',
  content: 'Unlimited PTO',
  createdBy: 'u-1',
}

describe('CreateKnowledgeService', () => {
  it('persists, publishes KnowledgeCreated and indexes the embedding', async () => {
    const repo = new FakeRepo()
    const vectors = new FakeVectors()
    const events = new FakeEvents()
    const svc = new CreateKnowledgeService(repo, new FakeEmbeddings([1, 2, 3]), vectors, events, clock)

    const r = await svc.execute(cmd)

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ id: 'k-1' })
    expect(repo.saved).toHaveLength(1)
    expect(events.published.some((e) => e.name === 'knowledge.KnowledgeCreated')).toBe(true)
    expect(vectors.savedEmbeddings).toEqual([{ id: 'k-1', embedding: [1, 2, 3] }])
  })

  it('fails on an invalid scope and never persists', async () => {
    const repo = new FakeRepo()
    const vectors = new FakeVectors()
    const svc = new CreateKnowledgeService(repo, new FakeEmbeddings(), vectors, new FakeEvents(), clock)

    const r = await svc.execute({ ...cmd, scope: 'bogus' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('Scope')
    expect(repo.saved).toHaveLength(0)
    expect(vectors.savedEmbeddings).toHaveLength(0)
  })

  it('swallows an embedding failure: the write still succeeds (best-effort)', async () => {
    const repo = new FakeRepo()
    const vectors = new FakeVectors()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const svc = new CreateKnowledgeService(
      repo,
      new FakeEmbeddings(new Error('voyage down')),
      vectors,
      new FakeEvents(),
      clock,
    )

    const r = await svc.execute(cmd)

    expect(r.ok).toBe(true)
    expect(repo.saved).toHaveLength(1)
    expect(vectors.savedEmbeddings).toHaveLength(0)
    errSpy.mockRestore()
  })

  it('skips saveEmbedding when the gateway returns null', async () => {
    const repo = new FakeRepo()
    const vectors = new FakeVectors()
    const svc = new CreateKnowledgeService(repo, new FakeEmbeddings(null), vectors, new FakeEvents(), clock)

    const r = await svc.execute(cmd)

    expect(r.ok).toBe(true)
    expect(repo.saved).toHaveLength(1)
    expect(vectors.savedEmbeddings).toHaveLength(0)
  })
})
