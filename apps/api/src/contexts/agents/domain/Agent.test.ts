import { describe, it, expect } from 'vitest'
import { Agent } from '@/contexts/agents/domain/Agent'
import { AgentId } from '@/contexts/agents/domain/AgentId'
import { AgentSlug } from '@/contexts/agents/domain/AgentSlug'

const NOW = new Date('2026-01-01T00:00:00Z')

function create(over: Partial<{ name: string; systemPrompt: string; isSystem: boolean }> = {}) {
  return Agent.create({
    id: AgentId.of('a1'),
    name: over.name ?? 'Helper Bot',
    slug: AgentSlug.fromName(over.name ?? 'Helper Bot'),
    systemPrompt: over.systemPrompt ?? 'You help.',
    isSystem: over.isSystem,
    createdBy: 'creator',
    now: NOW,
  })
}

describe('Agent.create', () => {
  it('builds a valid agent and records a creation event', () => {
    const r = create()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const agent = r.value
    expect(agent.name).toBe('Helper Bot')
    expect(agent.slug.value).toBe('helper_bot')
    expect(agent.isSystem).toBe(false)
    expect(agent.userId).toBeNull()
    const events = agent.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('agents.AgentCreated')
  })

  it('trims name and systemPrompt', () => {
    const r = create({ name: '  Spaced  ', systemPrompt: '  prompt  ' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.name).toBe('Spaced')
    expect(r.value.systemPrompt).toBe('prompt')
  })

  it('rejects an empty name', () => {
    const r = create({ name: '   ' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('name is required')
  })

  it('rejects an empty systemPrompt', () => {
    const r = create({ systemPrompt: '' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('systemPrompt is required')
  })
})

describe('Agent.ensureDeletable', () => {
  it('allows deleting a normal agent', () => {
    const r = create()
    if (!r.ok) throw new Error(r.error)
    expect(r.value.ensureDeletable().ok).toBe(true)
  })

  it('protects a system agent', () => {
    const r = create({ isSystem: true })
    if (!r.ok) throw new Error(r.error)
    const d = r.value.ensureDeletable()
    expect(d.ok).toBe(false)
    if (d.ok) return
    expect(d.error).toBe('Cannot delete system agent')
  })
})

describe('Agent.update', () => {
  it('applies a partial patch, updates the slug and stamps updatedAt', () => {
    const r = create()
    if (!r.ok) throw new Error(r.error)
    const agent = r.value
    agent.pullEvents() // clear creation event

    const later = new Date('2026-02-02T00:00:00Z')
    const res = agent.update({ name: 'Renamed', slug: AgentSlug.fromName('Renamed'), systemPrompt: 'new prompt' }, later)

    expect(res.ok).toBe(true)
    expect(agent.name).toBe('Renamed')
    expect(agent.slug.value).toBe('renamed')
    expect(agent.systemPrompt).toBe('new prompt')
    expect(agent.updatedAt).toBe(later)
    const events = agent.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('agents.AgentUpdated')
  })

  it('leaves the slug untouched when only non-name fields change', () => {
    const r = create()
    if (!r.ok) throw new Error(r.error)
    const agent = r.value
    agent.update({ description: 'desc only' }, NOW)
    expect(agent.slug.value).toBe('helper_bot')
    expect(agent.description).toBe('desc only')
  })

  it('rejects an empty name on update', () => {
    const r = create()
    if (!r.ok) throw new Error(r.error)
    const res = r.value.update({ name: '  ' }, NOW)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('name is required')
  })

  it('rejects an empty systemPrompt on update', () => {
    const r = create()
    if (!r.ok) throw new Error(r.error)
    const res = r.value.update({ systemPrompt: '   ' }, NOW)
    expect(res.ok).toBe(false)
  })
})

describe('Agent.linkBotUser / markDeleted', () => {
  it('links a backing bot user', () => {
    const r = create()
    if (!r.ok) throw new Error(r.error)
    r.value.linkBotUser('bot-123')
    expect(r.value.userId).toBe('bot-123')
  })

  it('records a deletion event', () => {
    const r = create()
    if (!r.ok) throw new Error(r.error)
    const agent = r.value
    agent.pullEvents()
    agent.markDeleted(NOW)
    const events = agent.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('agents.AgentDeleted')
  })
})
