import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DeleteSkillService } from '@/contexts/skills/application/use-cases/DeleteSkillService'
import { SkillRepository } from '@/contexts/skills/application/ports/out/SkillRepository'
import { Skill } from '@/contexts/skills/domain/Skill'
import { SkillId } from '@/contexts/skills/domain/ids'
import { Guardrails } from '@/contexts/skills/domain/Guardrails'

class FakeSkillRepo implements SkillRepository {
  deleted: string[] = []
  private byId = new Map<string, Skill>()
  private seq = 0
  nextId(): SkillId {
    return SkillId.of(`skill-${++this.seq}`)
  }
  async findById(id: SkillId): Promise<Skill | null> {
    return this.byId.get(id.value) ?? null
  }
  async existsBySlug(): Promise<boolean> {
    return false
  }
  async save(skill: Skill): Promise<void> {
    this.byId.set(skill.id.value, skill)
  }
  async delete(id: SkillId): Promise<void> {
    this.deleted.push(id.value)
    this.byId.delete(id.value)
  }
  seed(skill: Skill): void {
    skill.pullEvents()
    this.byId.set(skill.id.value, skill)
  }
}

class FakeEventPublisher implements EventPublisher {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

const clock: Clock = { now: () => new Date('2026-06-29T00:00:00Z') }

function buildSkill(id: string): Skill {
  const r = Skill.create({
    id: SkillId.of(id),
    name: 'Skill',
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

describe('DeleteSkillService', () => {
  it('hard-deletes the skill and publishes a deletion event', async () => {
    const repo = new FakeSkillRepo()
    repo.seed(buildSkill('s1'))
    const events = new FakeEventPublisher()
    const svc = new DeleteSkillService(repo, events, clock)

    const res = await svc.execute({ id: 's1' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.success).toBe(true)
    expect(repo.deleted).toEqual(['s1'])
    expect(events.published.map((e) => e.name)).toEqual(['skills.SkillDeleted'])
  })

  it('fails for an unknown skill (not idempotent, unlike agents)', async () => {
    const repo = new FakeSkillRepo()
    const events = new FakeEventPublisher()
    const svc = new DeleteSkillService(repo, events, clock)

    const res = await svc.execute({ id: 'missing' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('not found')
    expect(repo.deleted).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })
})
