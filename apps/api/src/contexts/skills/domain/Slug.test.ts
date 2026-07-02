import { describe, it, expect } from 'vitest'
import { slugify, slugTakenError } from '@/contexts/skills/domain/Slug'

describe('slugify', () => {
  it('lowercases and underscores words', () => {
    expect(slugify('Sales CRM')).toBe('sales_crm')
  })

  it('collapses punctuation runs', () => {
    expect(slugify('Sales & CRM')).toBe('sales_crm')
  })

  it('strips diacritics', () => {
    expect(slugify('Inventário Geral')).toBe('inventario_geral')
  })

  it('trims leading/trailing underscores', () => {
    expect(slugify('  Hello!  ')).toBe('hello')
  })

  it('falls back to "skill" for an empty result', () => {
    expect(slugify('🚀')).toBe('skill')
    expect(slugify('   ')).toBe('skill')
  })
})

describe('slugTakenError', () => {
  it('formats the uniqueness error', () => {
    expect(slugTakenError('sales_crm')).toBe('Skill: slug "sales_crm" is already in use')
  })
})
