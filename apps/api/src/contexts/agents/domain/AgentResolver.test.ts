import { describe, it, expect } from 'vitest'
import { AgentResolver, DEFAULT_AGENT_ID, SkillFragment } from '@/contexts/agents/domain/AgentResolver'
import { Agent } from '@/contexts/agents/domain/Agent'
import { AgentId } from '@/contexts/agents/domain/AgentId'
import { AgentSlug } from '@/contexts/agents/domain/AgentSlug'

function buildAgent(over: {
  id?: string
  name?: string
  systemPrompt?: string
  modelId?: string | null
  toolIds?: string[]
  skillIds?: string[]
} = {}): Agent {
  const name = over.name ?? 'Helper'
  const r = Agent.create({
    id: AgentId.of(over.id ?? 'a1'),
    name,
    slug: AgentSlug.fromName(name),
    systemPrompt: over.systemPrompt ?? 'Agent prompt',
    modelId: over.modelId,
    toolIds: over.toolIds,
    skillIds: over.skillIds,
    createdBy: 'creator',
    now: new Date('2026-01-01'),
  })
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('AgentResolver.resolve', () => {
  it('returns the named default when there is no agent', () => {
    const resolved = AgentResolver.resolve(null, [], 'Eric')
    expect(resolved).toEqual({
      id: DEFAULT_AGENT_ID,
      name: 'Eric',
      modelId: null,
      systemPromptFragments: [],
      toolIds: [],
      skillIds: [],
    })
  })

  it('stitches the agent prompt with each skill prompt in order', () => {
    const agent = buildAgent({ systemPrompt: 'AGENT', toolIds: [], skillIds: ['s1'] })
    const skills: SkillFragment[] = [
      { systemPrompt: 'SKILL_1', toolIds: [] },
      { systemPrompt: null, toolIds: [] }, // a skill with no prompt contributes nothing
      { systemPrompt: 'SKILL_2', toolIds: [] },
    ]
    const resolved = AgentResolver.resolve(agent, skills, 'Eric')
    expect(resolved.systemPromptFragments).toEqual(['AGENT', 'SKILL_1', 'SKILL_2'])
  })

  it('merges and dedupes tool ids across agent and skills', () => {
    const agent = buildAgent({ toolIds: ['t1', 't2'] })
    const skills: SkillFragment[] = [
      { systemPrompt: null, toolIds: ['t2', 't3'] },
      { systemPrompt: null, toolIds: ['t4'] },
    ]
    const resolved = AgentResolver.resolve(agent, skills, 'Eric')
    expect(resolved.toolIds).toEqual(['t1', 't2', 't3', 't4'])
  })

  it('passes through identity, model and skill ids of the agent', () => {
    const agent = buildAgent({ id: 'a9', name: 'Sales', modelId: 'claude-x', skillIds: ['s1', 's2'] })
    const resolved = AgentResolver.resolve(agent, [], 'Eric')
    expect(resolved.id).toBe('a9')
    expect(resolved.name).toBe('Sales')
    expect(resolved.modelId).toBe('claude-x')
    expect(resolved.skillIds).toEqual(['s1', 's2'])
  })
})
