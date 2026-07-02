import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateSkillService } from '@/contexts/skills/application/use-cases/CreateSkillService'
import { SkillRepository } from '@/contexts/skills/application/ports/out/SkillRepository'
import { Skill } from '@/contexts/skills/domain/Skill'
import { SkillId } from '@/contexts/skills/domain/ids'

class FakeSkillRepo implements SkillRepository {
  saved: Skill[] = []
  private byId = new Map<string, Skill>()
  private slugOwners = new Map<string, string>()
  private seq = 0
  nextId(): SkillId {
    return SkillId.of(`skill-${++this.seq}`)
  }
  async findById(id: SkillId): Promise<Skill | null> {
    return this.byId.get(id.value) ?? null
  }
  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const owner = this.slugOwners.get(slug)
    if (owner === undefined) return false
    if (excludeId && owner === excludeId) return false
    return true
  }
  async save(skill: Skill): Promise<void> {
    this.saved.push(skill)
    this.byId.set(skill.id.value, skill)
    this.slugOwners.set(skill.slug, skill.id.value)
  }
  async delete(id: SkillId): Promise<void> {
    this.byId.delete(id.value)
  }
  seedSlug(slug: string, ownerId: string): void {
    this.slugOwners.set(slug, ownerId)
  }
}

class FakeEventPublisher implements EventPublisher {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

const clock: Clock = { now: () => new Date('2026-06-29T00:00:00Z') }

describe('CreateSkillService', () => {
  it('creates a skill, persists it and publishes a creation event', async () => {
    const repo = new FakeSkillRepo()
    const events = new FakeEventPublisher()
    const svc = new CreateSkillService(repo, events, clock)

    const res = await svc.execute({
      name: 'My Skill',
      systemPrompt: 'Do it.',
      guardrails: { maxSteps: 3 },
      createdBy: 'user-1',
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.id).toBe('skill-1')
    expect(res.value.slug).toBe('my_skill')
    expect(repo.saved).toHaveLength(1)
    expect(events.published.map((e) => e.name)).toEqual(['skills.SkillCreated'])
  })

  it('rejects invalid guardrails before building the aggregate', async () => {
    const repo = new FakeSkillRepo()
    const svc = new CreateSkillService(repo, new FakeEventPublisher(), clock)

    const res = await svc.execute({ name: 'X', systemPrompt: 'y', guardrails: { maxSteps: 0 }, createdBy: 'u' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('maxSteps must be a positive integer')
    expect(repo.saved).toHaveLength(0)
  })

  it('propagates a domain validation failure', async () => {
    const repo = new FakeSkillRepo()
    const svc = new CreateSkillService(repo, new FakeEventPublisher(), clock)

    const res = await svc.execute({ name: 'Valid', systemPrompt: '   ', createdBy: 'u' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('systemPrompt is required')
    expect(repo.saved).toHaveLength(0)
  })

  it('rejects a duplicate slug', async () => {
    const repo = new FakeSkillRepo()
    repo.seedSlug('my_skill', 'other')
    const svc = new CreateSkillService(repo, new FakeEventPublisher(), clock)

    const res = await svc.execute({ name: 'My Skill', systemPrompt: 'do', createdBy: 'u' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('already in use')
    expect(repo.saved).toHaveLength(0)
  })
})
