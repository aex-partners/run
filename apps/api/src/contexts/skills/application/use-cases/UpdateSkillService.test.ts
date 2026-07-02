import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UpdateSkillService } from '@/contexts/skills/application/use-cases/UpdateSkillService'
import { SkillRepository } from '@/contexts/skills/application/ports/out/SkillRepository'
import { Skill } from '@/contexts/skills/domain/Skill'
import { SkillId } from '@/contexts/skills/domain/ids'
import { Guardrails } from '@/contexts/skills/domain/Guardrails'

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
  seed(skill: Skill): void {
    skill.pullEvents()
    this.byId.set(skill.id.value, skill)
    this.slugOwners.set(skill.slug, skill.id.value)
  }
}

class FakeEventPublisher implements EventPublisher {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

const clock: Clock = { now: () => new Date('2026-06-29T00:00:00Z') }

function buildSkill(id: string, name: string): Skill {
  const r = Skill.create({
    id: SkillId.of(id),
    name,
    description: null,
    systemPrompt: 'prompt',
    toolIds: [],
    systemToolNames: [],
    guardrails: Guardrails.empty(),
    createdBy: 'creator',
    now: new Date('2026-01-01'),
  })
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('UpdateSkillService', () => {
  it('updates a field, persists and publishes an update event', async () => {
    const repo = new FakeSkillRepo()
    repo.seed(buildSkill('s1', 'Alpha'))
    const events = new FakeEventPublisher()
    const svc = new UpdateSkillService(repo, events, clock)

    const res = await svc.execute({ id: 's1', systemPrompt: 'new prompt' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.id).toBe('s1')
    expect(repo.saved).toHaveLength(1)
    expect(events.published.map((e) => e.name)).toEqual(['skills.SkillUpdated'])
  })

  it('returns not-found for an unknown skill', async () => {
    const svc = new UpdateSkillService(new FakeSkillRepo(), new FakeEventPublisher(), clock)
    const res = await svc.execute({ id: 'missing', systemPrompt: 'x' })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('not found')
  })

  it('validates supplied guardrails', async () => {
    const repo = new FakeSkillRepo()
    repo.seed(buildSkill('s1', 'Alpha'))
    const svc = new UpdateSkillService(repo, new FakeEventPublisher(), clock)

    const res = await svc.execute({ id: 's1', guardrails: { maxSteps: -2 } })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('maxSteps must be a positive integer')
    expect(repo.saved).toHaveLength(0)
  })

  it('rejects a rename that collides with another skill slug', async () => {
    const repo = new FakeSkillRepo()
    repo.seed(buildSkill('s1', 'Alpha'))
    repo.seed(buildSkill('s2', 'Beta'))
    const svc = new UpdateSkillService(repo, new FakeEventPublisher(), clock)

    const res = await svc.execute({ id: 's1', name: 'Beta' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('already in use')
    expect(repo.saved).toHaveLength(0)
  })

  it('allows a rename whose slug is free', async () => {
    const repo = new FakeSkillRepo()
    repo.seed(buildSkill('s1', 'Alpha'))
    const svc = new UpdateSkillService(repo, new FakeEventPublisher(), clock)

    const res = await svc.execute({ id: 's1', name: 'Gamma' })
    expect(res.ok).toBe(true)
    expect(repo.saved).toHaveLength(1)
  })

  it('rejects an empty name on update', async () => {
    const repo = new FakeSkillRepo()
    repo.seed(buildSkill('s1', 'Alpha'))
    const svc = new UpdateSkillService(repo, new FakeEventPublisher(), clock)

    const res = await svc.execute({ id: 's1', name: '   ' })
    expect(res.ok).toBe(false)
  })
})
