import { describe, it, expect } from 'vitest'
import { Skill } from '@/contexts/skills/domain/Skill'
import { SkillId } from '@/contexts/skills/domain/ids'
import { Guardrails } from '@/contexts/skills/domain/Guardrails'

const NOW = new Date('2026-06-29T00:00:00Z')

function create(over: Partial<{
  name: string
  systemPrompt: string
  toolIds: string[]
  systemToolNames: string[]
}> = {}) {
  return Skill.create({
    id: SkillId.of('s1'),
    name: over.name ?? 'My Skill',
    description: null,
    systemPrompt: over.systemPrompt ?? 'Do the thing.',
    toolIds: over.toolIds ?? [],
    systemToolNames: over.systemToolNames ?? [],
    guardrails: Guardrails.empty(),
    createdBy: 'creator',
    now: NOW,
  })
}

describe('Skill.create', () => {
  it('builds a valid skill, derives the slug and records a creation event', () => {
    const r = create()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const skill = r.value
    expect(skill.name).toBe('My Skill')
    expect(skill.slug).toBe('my_skill')
    const events = skill.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('skills.SkillCreated')
  })

  it('trims name and systemPrompt', () => {
    const r = create({ name: '  Spaced  ', systemPrompt: '  prompt  ' })
    if (!r.ok) throw new Error(r.error)
    expect(r.value.name).toBe('Spaced')
    expect(r.value.systemPrompt).toBe('prompt')
  })

  it('normalizes tool reference lists (trim, drop empties, dedupe, keep order)', () => {
    const r = create({ toolIds: ['t1', ' t1 ', '', 't2'], systemToolNames: ['Read', 'Read'] })
    if (!r.ok) throw new Error(r.error)
    expect(r.value.toolIds).toEqual(['t1', 't2'])
    expect(r.value.systemToolNames).toEqual(['Read'])
  })

  it('rejects an empty name', () => {
    const r = create({ name: '  ' })
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

describe('Skill.update', () => {
  it('renames, re-derives the slug, flags nameChanged and records an event', () => {
    const r = create()
    if (!r.ok) throw new Error(r.error)
    const skill = r.value
    skill.pullEvents()

    const later = new Date('2026-07-01T00:00:00Z')
    const res = skill.update({ name: 'Renamed Skill' }, later)

    expect(res.ok).toBe(true)
    expect(skill.name).toBe('Renamed Skill')
    expect(skill.slug).toBe('renamed_skill')
    expect(skill.nameChanged()).toBe(true)
    expect(skill.updatedAt).toBe(later)
    const events = skill.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('skills.SkillUpdated')
  })

  it('does not flag nameChanged when the name is untouched', () => {
    const r = create()
    if (!r.ok) throw new Error(r.error)
    const skill = r.value
    skill.update({ systemPrompt: 'new prompt' }, NOW)
    expect(skill.nameChanged()).toBe(false)
    expect(skill.systemPrompt).toBe('new prompt')
  })

  it('swaps the guardrails VO whole', () => {
    const r = create()
    if (!r.ok) throw new Error(r.error)
    const g = Guardrails.of({ maxSteps: 4 })
    if (!g.ok) throw new Error(g.error)
    r.value.update({ guardrails: g.value }, NOW)
    expect(r.value.guardrails.maxSteps).toBe(4)
  })

  it('rejects an empty name or systemPrompt on update', () => {
    const r = create()
    if (!r.ok) throw new Error(r.error)
    expect(r.value.update({ name: '   ' }, NOW).ok).toBe(false)
    expect(r.value.update({ systemPrompt: '   ' }, NOW).ok).toBe(false)
  })
})

describe('Skill.markDeleted', () => {
  it('records a deletion event', () => {
    const r = create()
    if (!r.ok) throw new Error(r.error)
    const skill = r.value
    skill.pullEvents()
    skill.markDeleted(NOW)
    const events = skill.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('skills.SkillDeleted')
  })
})
