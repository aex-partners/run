import { describe, it, expect } from 'vitest'
import { ResolveAgentService } from '@/contexts/agents/application/use-cases/ResolveAgentService'
import { AgentRepository } from '@/contexts/agents/application/ports/out/AgentRepository'
import { Agent } from '@/contexts/agents/domain/Agent'
import { AgentId } from '@/contexts/agents/domain/AgentId'
import { AgentSlug } from '@/contexts/agents/domain/AgentSlug'
import { DEFAULT_AGENT_ID } from '@/contexts/agents/domain/AgentResolver'

class FakeAgentRepo implements AgentRepository {
  private byId = new Map<string, Agent>()
  nextId(): AgentId {
    return AgentId.of('x')
  }
  async findById(id: AgentId): Promise<Agent | null> {
    return this.byId.get(id.value) ?? null
  }
  async existsBySlug(): Promise<boolean> {
    return false
  }
  async save(): Promise<void> {}
  async delete(): Promise<void> {}
  seed(agent: Agent): void {
    this.byId.set(agent.id.value, agent)
  }
}

function buildAgent(): Agent {
  const r = Agent.create({
    id: AgentId.of('a1'),
    name: 'Sales',
    slug: AgentSlug.fromName('Sales'),
    systemPrompt: 'AGENT_PROMPT',
    toolIds: ['t1'],
    skillIds: ['s1'],
    createdBy: 'creator',
    now: new Date('2026-01-01'),
  })
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('ResolveAgentService', () => {
  it('returns the named default when agentId is null', async () => {
    const svc = new ResolveAgentService(new FakeAgentRepo())
    const resolved = await svc.execute({ agentId: null, defaultName: 'Eric' })
    expect(resolved.id).toBe(DEFAULT_AGENT_ID)
    expect(resolved.name).toBe('Eric')
  })

  it('loads the agent and applies the resolver merge rule over supplied skills', async () => {
    const repo = new FakeAgentRepo()
    repo.seed(buildAgent())
    const svc = new ResolveAgentService(repo)

    const resolved = await svc.execute({
      agentId: 'a1',
      defaultName: 'Eric',
      skills: [{ systemPrompt: 'SKILL_PROMPT', toolIds: ['t1', 't2'] }],
    })

    expect(resolved.id).toBe('a1')
    expect(resolved.systemPromptFragments).toEqual(['AGENT_PROMPT', 'SKILL_PROMPT'])
    expect(resolved.toolIds).toEqual(['t1', 't2'])
    expect(resolved.skillIds).toEqual(['s1'])
  })
})
