import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DeleteAgentService } from '@/contexts/agents/application/use-cases/DeleteAgentService'
import { AgentRepository } from '@/contexts/agents/application/ports/out/AgentRepository'
import { Agent } from '@/contexts/agents/domain/Agent'
import { AgentId } from '@/contexts/agents/domain/AgentId'
import { AgentSlug } from '@/contexts/agents/domain/AgentSlug'

class FakeAgentRepo implements AgentRepository {
  deleted: string[] = []
  private byId = new Map<string, Agent>()
  private seq = 0
  nextId(): AgentId {
    return AgentId.of(`agent-${++this.seq}`)
  }
  async findById(id: AgentId): Promise<Agent | null> {
    return this.byId.get(id.value) ?? null
  }
  async existsBySlug(): Promise<boolean> {
    return false
  }
  async save(agent: Agent): Promise<void> {
    this.byId.set(agent.id.value, agent)
  }
  async delete(id: AgentId): Promise<void> {
    this.deleted.push(id.value)
    this.byId.delete(id.value)
  }
  seed(agent: Agent): void {
    agent.pullEvents()
    this.byId.set(agent.id.value, agent)
  }
}

class FakeEventPublisher implements EventPublisher {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

const clock: Clock = { now: () => new Date('2026-06-29T00:00:00Z') }

function buildAgent(id: string, isSystem = false): Agent {
  const r = Agent.create({
    id: AgentId.of(id),
    name: 'Bot',
    slug: AgentSlug.fromName('Bot'),
    systemPrompt: 'prompt',
    isSystem,
    createdBy: 'creator',
    now: new Date('2026-01-01'),
  })
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('DeleteAgentService', () => {
  it('deletes a normal agent and publishes a deletion event', async () => {
    const repo = new FakeAgentRepo()
    repo.seed(buildAgent('a1'))
    const events = new FakeEventPublisher()
    const svc = new DeleteAgentService(repo, events, clock)

    const res = await svc.execute({ id: 'a1' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.success).toBe(true)
    expect(repo.deleted).toEqual(['a1'])
    expect(events.published.map((e) => e.name)).toEqual(['agents.AgentDeleted'])
  })

  it('refuses to delete a system agent', async () => {
    const repo = new FakeAgentRepo()
    repo.seed(buildAgent('sys', true))
    const events = new FakeEventPublisher()
    const svc = new DeleteAgentService(repo, events, clock)

    const res = await svc.execute({ id: 'sys' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('Cannot delete system agent')
    expect(repo.deleted).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })

  it('is an idempotent no-op success for an unknown agent', async () => {
    const repo = new FakeAgentRepo()
    const events = new FakeEventPublisher()
    const svc = new DeleteAgentService(repo, events, clock)

    const res = await svc.execute({ id: 'missing' })

    expect(res.ok).toBe(true)
    expect(repo.deleted).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })
})
