import { describe, it, expect } from 'vitest'
import { SKILL_TEMPLATES, getSkillsForRoutines } from '@/contexts/skills/domain/SkillTemplate'

describe('SKILL_TEMPLATES catalog', () => {
  it('is non-empty with unique slugs', () => {
    expect(SKILL_TEMPLATES.length).toBeGreaterThan(0)
    const slugs = SKILL_TEMPLATES.map((t) => t.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('every template has name, category, routineIds and a system prompt', () => {
    for (const t of SKILL_TEMPLATES) {
      expect(t.name.length).toBeGreaterThan(0)
      expect(t.category.length).toBeGreaterThan(0)
      expect(t.routineIds.length).toBeGreaterThan(0)
      expect(t.systemPrompt.length).toBeGreaterThan(0)
    }
  })
})

describe('getSkillsForRoutines', () => {
  it('returns nothing for no routines', () => {
    expect(getSkillsForRoutines([])).toEqual([])
  })

  it('returns nothing for an unmatched routine', () => {
    expect(getSkillsForRoutines(['does-not-exist'])).toEqual([])
  })

  it('matches every template that references the routine', () => {
    const slugs = getSkillsForRoutines(['lead-capture']).map((t) => t.slug)
    expect(slugs).toEqual(expect.arrayContaining(['sales-crm', 'marketing']))
  })

  it('matches a template if ANY of its routineIds was selected', () => {
    const slugs = getSkillsForRoutines(['maintenance']).map((t) => t.slug)
    // both manufacturing and fleet list 'maintenance' among their routineIds
    expect(slugs).toEqual(expect.arrayContaining(['manufacturing', 'fleet']))
  })

  it('returns each matching template once even across multiple selected routines', () => {
    // sales-crm matches several of these routine ids; it must not be duplicated.
    const result = getSkillsForRoutines(['lead-capture', 'sales-pipeline', 'customer-crm'])
    const salesCount = result.filter((t) => t.slug === 'sales-crm').length
    expect(salesCount).toBe(1)
  })
})
