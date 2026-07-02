import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateAgentService } from '@/contexts/agents/application/use-cases/CreateAgentService'
import { AgentRepository } from '@/contexts/agents/application/ports/out/AgentRepository'
import { BotUserProvisioner, ProvisionBotInput } from '@/contexts/agents/application/ports/out/BotUserProvisioner'
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
  seedSlug(slug: string, ownerId: string): void {
    this.slugOwners.set(slug, ownerId)
  }
}

class FakeBotProvisioner implements BotUserProvisioner {
  calls: ProvisionBotInput[] = []
  async provision(input: ProvisionBotInput): Promise<{ userId: string }> {
    this.calls.push(input)
    return { userId: `bot-${input.agentId}` }
  }
}

class FakeEventPublisher implements EventPublisher {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

const clock: Clock = { now: () => new Date('2026-06-29T00:00:00Z') }

describe('CreateAgentService', () => {
  it('creates an agent, provisions and links a bot user, persists and publishes', async () => {
    const repo = new FakeAgentRepo()
    const bots = new FakeBotProvisioner()
    const events = new FakeEventPublisher()
    const svc = new CreateAgentService(repo, bots, events, clock)

    const res = await svc.execute({
      actorId: 'user-1',
      name: 'Sales Bot',
      systemPrompt: 'Close deals.',
      toolIds: ['query'],
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.id).toBe('agent-1')
    expect(res.value.slug).toBe('sales_bot')
    expect(res.value.userId).toBe('bot-agent-1')
    expect(res.value.toolIds).toEqual(['query'])

    expect(bots.calls).toEqual([{ name: 'Sales Bot', avatar: null, agentId: 'agent-1' }])
    expect(repo.saved).toHaveLength(1)
    expect(events.published.some((e) => e.name === 'agents.AgentCreated')).toBe(true)
  })

  it('rejects a duplicate slug before provisioning anything', async () => {
    const repo = new FakeAgentRepo()
    repo.seedSlug('sales_bot', 'other-agent')
    const bots = new FakeBotProvisioner()
    const svc = new CreateAgentService(repo, bots, new FakeEventPublisher(), clock)

    const res = await svc.execute({ actorId: 'u', name: 'Sales Bot', systemPrompt: 'x' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('already in use')
    expect(bots.calls).toHaveLength(0)
    expect(repo.saved).toHaveLength(0)
  })

  it('propagates a domain validation failure without provisioning', async () => {
    const repo = new FakeAgentRepo()
    const bots = new FakeBotProvisioner()
    const svc = new CreateAgentService(repo, bots, new FakeEventPublisher(), clock)

    const res = await svc.execute({ actorId: 'u', name: 'Valid Name', systemPrompt: '   ' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('systemPrompt is required')
    expect(bots.calls).toHaveLength(0)
    expect(repo.saved).toHaveLength(0)
  })
})
