import { describe, it, expect } from 'vitest'
import { DeleteKnowledgeService } from '@/contexts/knowledge/application/use-cases/DeleteKnowledgeService'
import { KnowledgeRepository } from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'
import { Knowledge } from '@/contexts/knowledge/domain/Knowledge'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

function knowledgeOf(id: string, scope: string, createdBy: string | null): Knowledge {
  const r = Knowledge.create(
    KnowledgeId.of(id),
    { scope, category: 'note', title: 'T', content: 'C', createdBy },
    NOW,
  )
  if (!r.ok) throw new Error('setup failed')
  r.value.pullEvents()
  return r.value
}

class FakeRepo implements KnowledgeRepository {
  deleted: string[] = []
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
  async save(): Promise<void> {}
  async delete(id: KnowledgeId): Promise<void> {
    this.deleted.push(id.value)
  }
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

class FakeEvents {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

describe('DeleteKnowledgeService', () => {
  it('deletes a company entry and publishes KnowledgeDeleted', async () => {
    const repo = new FakeRepo(new Map([['k1', knowledgeOf('k1', 'company', 'owner')]]))
    const events = new FakeEvents()
    const svc = new DeleteKnowledgeService(repo, events, clock)

    const r = await svc.execute({ id: 'k1', requestedBy: 'anyone' })

    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ success: true })
    expect(repo.deleted).toEqual(['k1'])
    expect(events.published.some((e) => e.name === 'knowledge.KnowledgeDeleted')).toBe(true)
  })

  it('lets the owner delete their personal entry', async () => {
    const repo = new FakeRepo(new Map([['k1', knowledgeOf('k1', 'personal', 'owner')]]))
    const svc = new DeleteKnowledgeService(repo, new FakeEvents(), clock)

    const r = await svc.execute({ id: 'k1', requestedBy: 'owner' })

    expect(r.ok).toBe(true)
    expect(repo.deleted).toEqual(['k1'])
  })

  it('fails when the entry is not found', async () => {
    const repo = new FakeRepo()
    const svc = new DeleteKnowledgeService(repo, new FakeEvents(), clock)

    const r = await svc.execute({ id: 'gone', requestedBy: 'u' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('not found')
    expect(repo.deleted).toHaveLength(0)
  })

  it('forbids deleting another user\'s personal entry', async () => {
    const repo = new FakeRepo(new Map([['k1', knowledgeOf('k1', 'personal', 'owner')]]))
    const events = new FakeEvents()
    const svc = new DeleteKnowledgeService(repo, events, clock)

    const r = await svc.execute({ id: 'k1', requestedBy: 'intruder' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('cannot delete')
    expect(repo.deleted).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })
})
