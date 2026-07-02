import { describe, it, expect } from 'vitest'
import { AgentSlug } from '@/contexts/agents/domain/AgentSlug'

describe('AgentSlug.fromName', () => {
  it('lowercases and joins words with underscores', () => {
    expect(AgentSlug.fromName('Sales Bot').value).toBe('sales_bot')
  })

  it('strips diacritics', () => {
    expect(AgentSlug.fromName('São Paulo').value).toBe('sao_paulo')
  })

  it('collapses runs of punctuation and trims leading/trailing underscores', () => {
    expect(AgentSlug.fromName('Hello,  World!!').value).toBe('hello_world')
    expect(AgentSlug.fromName('__Hi__').value).toBe('hi')
  })

  it('falls back to "agent" for an empty/emoji-only name', () => {
    expect(AgentSlug.fromName('🚀').value).toBe('agent')
    expect(AgentSlug.fromName('   ').value).toBe('agent')
  })
})

describe('AgentSlug.of / equals', () => {
  it('wraps a raw value verbatim', () => {
    expect(AgentSlug.of('my_slug').value).toBe('my_slug')
  })

  it('compares by value', () => {
    expect(AgentSlug.of('a').equals(AgentSlug.of('a'))).toBe(true)
    expect(AgentSlug.of('a').equals(AgentSlug.of('b'))).toBe(false)
  })

  it('stringifies to its value', () => {
    expect(AgentSlug.of('x').toString()).toBe('x')
  })
})
