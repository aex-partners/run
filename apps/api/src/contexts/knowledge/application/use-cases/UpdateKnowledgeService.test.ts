import { describe, it, expect } from 'vitest'
import { UpdateKnowledgeService } from '@/contexts/knowledge/application/use-cases/UpdateKnowledgeService'
import { KnowledgeRepository } from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'
import { EmbeddingGateway } from '@/contexts/knowledge/application/ports/out/EmbeddingGateway'
import { VectorStore } from '@/contexts/knowledge/application/ports/out/VectorStore'
import { Knowledge } from '@/contexts/knowledge/domain/Knowledge'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

function knowledgeOf(id: string, scope: string, createdBy: string | null): Knowledge {
  const r = Knowledge.create(
    KnowledgeId.of(id),
    { scope, category: 'note', title: 'Old', content: 'Old content', createdBy },
    NOW,
  )
  if (!r.ok) throw new Error('setup failed')
  r.value.pullEvents()
  return r.value
}

class FakeRepo implements KnowledgeRepository {
  saved: Knowledge[] = []
  constructor(private readonly byId: Map<string, Knowledge> = new Map()) {}
  nextId(): KnowledgeId {
    return KnowledgeId.of('x')
  }
  async findById(id: KnowledgeId): Promise<Knowledge | null> {
    return this.byId.get(id.value) ?? null
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
  calls = 0
  async embedDocument(): Promise<number[] | null> {
    this.calls++
    return [1, 2, 3]
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

describe('UpdateKnowledgeService', () => {
  it('updates content, persists, publishes and re-embeds', async () => {
    const repo = new FakeRepo(new Map([['k1', knowledgeOf('k1', 'company', 'owner')]]))
    const embeddings = new FakeEmbeddings()
    const vectors = new FakeVectors()
    const events = new FakeEvents()
    const svc = new UpdateKnowledgeService(repo, embeddings, vectors, events, clock)

    const r = await svc.execute({ id: 'k1', requestedBy: 'owner', content: 'New content' })

    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ success: true })
    expect(repo.saved).toHaveLength(1)
    expect(events.published.some((e) => e.name === 'knowledge.KnowledgeUpdated')).toBe(true)
    expect(embeddings.calls).toBe(1)
    expect(vectors.savedEmbeddings).toEqual(['k1'])
  })

  it('does NOT re-embed when only scope/category change (content unchanged)', async () => {
    const repo = new FakeRepo(new Map([['k1', knowledgeOf('k1', 'company', 'owner')]]))
    const embeddings = new FakeEmbeddings()
    const vectors = new FakeVectors()
    const svc = new UpdateKnowledgeService(repo, embeddings, vectors, new FakeEvents(), clock)

    const r = await svc.execute({ id: 'k1', requestedBy: 'owner', scope: 'personal' })

    expect(r.ok).toBe(true)
    expect(repo.saved).toHaveLength(1)
    expect(embeddings.calls).toBe(0)
    expect(vectors.savedEmbeddings).toHaveLength(0)
  })

  it('fails when the entry is not found', async () => {
    const svc = new UpdateKnowledgeService(new FakeRepo(), new FakeEmbeddings(), new FakeVectors(), new FakeEvents(), clock)

    const r = await svc.execute({ id: 'gone', requestedBy: 'u', title: 'x' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('not found')
  })

  it('forbids editing another user\'s personal entry', async () => {
    const repo = new FakeRepo(new Map([['k1', knowledgeOf('k1', 'personal', 'owner')]]))
    const svc = new UpdateKnowledgeService(repo, new FakeEmbeddings(), new FakeVectors(), new FakeEvents(), clock)

    const r = await svc.execute({ id: 'k1', requestedBy: 'intruder', title: 'x' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('forbidden')
    expect(repo.saved).toHaveLength(0)
  })

  it('propagates a domain validation failure (blank title) without persisting', async () => {
    const repo = new FakeRepo(new Map([['k1', knowledgeOf('k1', 'company', 'owner')]]))
    const svc = new UpdateKnowledgeService(repo, new FakeEmbeddings(), new FakeVectors(), new FakeEvents(), clock)

    const r = await svc.execute({ id: 'k1', requestedBy: 'owner', title: '   ' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('title must not be empty')
    expect(repo.saved).toHaveLength(0)
  })
})
