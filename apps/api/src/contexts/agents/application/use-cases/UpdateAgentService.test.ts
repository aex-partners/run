import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UpdateAgentService } from '@/contexts/agents/application/use-cases/UpdateAgentService'
import { AgentRepository } from '@/contexts/agents/application/ports/out/AgentRepository'
import { Agent } from '@/contexts/agents/domain/Agent'
import { AgentId } from '@/contexts/agents/domain/AgentId'
import { AgentSlug } from '@/contexts/agents/domain/AgentSlug'

class FakeAgentRepo implements AgentRepository {
  saved: Agent[] = []
  private byId = new Map<string, Agent>()
  private slugOwners = new Map<string, string>()
  private seq = 0
  nextId(): AgentId {
    return AgentId.of(`agent-${++this.seq}`)
  }
  async findById(id: AgentId): Promise<Agent | null> {
    return this.byId.get(id.value) ?? null
  }
  async existsBySlug(slug: AgentSlug, exceptId?: AgentId): Promise<boolean> {
    const owner = this.slugOwners.get(slug.value)
    if (owner === undefined) return false
    if (exceptId && owner === exceptId.value) return false
    return true
  }
  async save(agent: Agent): Promise<void> {
    this.saved.push(agent)
    this.byId.set(agent.id.value, agent)
    this.slugOwners.set(agent.slug.value, agent.id.value)
  }
  async delete(id: AgentId): Promise<void> {
    this.byId.delete(id.value)
  }
  seed(agent: Agent): void {
    agent.pullEvents() // clear the creation event so published only shows the update
    this.byId.set(agent.id.value, agent)
    this.slugOwners.set(agent.slug.value, agent.id.value)
  }
}

class FakeEventPublisher implements EventPublisher {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

const clock: Clock = { now: () => new Date('2026-06-29T00:00:00Z') }

function buildAgent(id: string, name: string): Agent {
  const r = Agent.create({
    id: AgentId.of(id),
    name,
    slug: AgentSlug.fromName(name),
    systemPrompt: 'prompt',
    createdBy: 'creator',
    now: new Date('2026-01-01'),
  })
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('UpdateAgentService', () => {
  it('updates a field, persists and publishes an update event', async () => {
    const repo = new FakeAgentRepo()
    repo.seed(buildAgent('a1', 'Alpha'))
    const events = new FakeEventPublisher()
    const svc = new UpdateAgentService(repo, events, clock)

    const res = await svc.execute({ id: 'a1', systemPrompt: 'new prompt' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.systemPrompt).toBe('new prompt')
    expect(repo.saved).toHaveLength(1)
    expect(events.published.map((e) => e.name)).toEqual(['agents.AgentUpdated'])
  })

  it('regenerates the slug on rename and projects the new name/slug', async () => {
    const repo = new FakeAgentRepo()
    repo.seed(buildAgent('a1', 'Alpha'))
    const svc = new UpdateAgentService(repo, new FakeEventPublisher(), clock)

    const res = await svc.execute({ id: 'a1', name: 'Bravo Team' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.name).toBe('Bravo Team')
    expect(res.value.slug).toBe('bravo_team')
  })

  it('returns not-found for an unknown agent', async () => {
    const svc = new UpdateAgentService(new FakeAgentRepo(), new FakeEventPublisher(), clock)
    const res = await svc.execute({ id: 'missing', name: 'X' })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('Agent not found')
  })

  it('rejects a rename that collides with another agent slug', async () => {
    const repo = new FakeAgentRepo()
    repo.seed(buildAgent('a1', 'Alpha'))
    repo.seed(buildAgent('a2', 'Beta'))
    const svc = new UpdateAgentService(repo, new FakeEventPublisher(), clock)

    const res = await svc.execute({ id: 'a1', name: 'Beta' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('already in use')
    expect(repo.saved).toHaveLength(0)
  })

  it('allows a rename to its own slug-free new name', async () => {
    const repo = new FakeAgentRepo()
    repo.seed(buildAgent('a1', 'Alpha'))
    const svc = new UpdateAgentService(repo, new FakeEventPublisher(), clock)

    const res = await svc.execute({ id: 'a1', name: 'Gamma' })
    expect(res.ok).toBe(true)
  })
})
