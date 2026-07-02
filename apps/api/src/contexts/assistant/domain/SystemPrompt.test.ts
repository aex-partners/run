import { describe, it, expect } from 'vitest'
import { assembleSystemPrompt, BASE_PROMPT } from '@/contexts/assistant/domain/SystemPrompt'

describe('assembleSystemPrompt', () => {
  it('returns the base prompt with no context', () => {
    const out = assembleSystemPrompt()
    expect(out).toBe(BASE_PROMPT)
    expect(out).toContain('You are Eric,')
  })

  it('renames the agent in the base prompt', () => {
    const out = assembleSystemPrompt({ agentName: 'Aria' })
    expect(out).toContain('You are Aria,')
    expect(out).not.toContain('You are Eric,')
  })

  it('adds the infra advisory only when searxng is unavailable', () => {
    expect(assembleSystemPrompt({ searxngAvailable: false })).toContain('Infra advisory')
    expect(assembleSystemPrompt({ searxngAvailable: true })).not.toContain('Infra advisory')
    expect(assembleSystemPrompt({})).not.toContain('Infra advisory')
  })

  it('appends non-empty agent prompt fragments under a heading', () => {
    const out = assembleSystemPrompt({ agentPromptFragments: ['be terse', '', 'cite sources'] })
    expect(out).toContain('## Agent Instructions')
    expect(out).toContain('be terse')
    expect(out).toContain('cite sources')
  })

  it('maps pt-BR to a Brazilian Portuguese instruction', () => {
    expect(assembleSystemPrompt({ language: 'pt-BR' })).toContain('Brazilian Portuguese')
  })

  it('passes through any other language verbatim and strips quotes', () => {
    expect(assembleSystemPrompt({ language: 'es' })).toContain('respond in es')
    expect(assembleSystemPrompt({ language: '"en"' })).toContain('respond in en')
  })

  it('does not add a language section when language is null', () => {
    expect(assembleSystemPrompt({ language: null })).not.toContain('Always respond in')
  })

  it('includes company, knowledge and entity sections when present', () => {
    const out = assembleSystemPrompt({
      companyLines: ['Name: ACME', 'Website: acme.test'],
      knowledgeText: 'sells widgets',
      entitiesText: 'Order, Customer',
    })
    expect(out).toContain('## Company Context')
    expect(out).toContain('Name: ACME')
    expect(out).toContain('## Knowledge')
    expect(out).toContain('sells widgets')
    expect(out).toContain('## Available Entities')
    expect(out).toContain('Order, Customer')
  })

  it('renders active flows, capped at 20 entries', () => {
    const flows = Array.from({ length: 25 }, (_, i) => `flow-${i}`)
    const out = assembleSystemPrompt({ activeFlows: flows })
    expect(out).toContain('## Active Flows')
    const rendered = (out.match(/- flow-\d+/g) ?? []).length
    expect(rendered).toBe(20)
  })

  it('omits empty company/flows sections', () => {
    const out = assembleSystemPrompt({ companyLines: [], activeFlows: [] })
    expect(out).not.toContain('## Company Context')
    expect(out).not.toContain('## Active Flows')
  })

  it('composes sections in order: base, advisory, agent, language', () => {
    const out = assembleSystemPrompt({
      agentName: 'Aria',
      searxngAvailable: false,
      agentPromptFragments: ['FRAGMENT_MARKER'],
      language: 'pt-BR',
    })
    expect(out.indexOf('You are Aria,')).toBeLessThan(out.indexOf('Infra advisory'))
    expect(out.indexOf('Infra advisory')).toBeLessThan(out.indexOf('FRAGMENT_MARKER'))
    expect(out.indexOf('FRAGMENT_MARKER')).toBeLessThan(out.indexOf('Brazilian Portuguese'))
  })
})
