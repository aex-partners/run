import { describe, it, expect } from 'vitest'
import { buildSubagents } from '@/contexts/assistant/domain/Subagents'

describe('buildSubagents', () => {
  it('returns the three specialist agents', () => {
    const subs = buildSubagents()
    expect(Object.keys(subs).sort()).toEqual(['analyst', 'automator', 'researcher'])
  })

  it('gives every subagent a description, prompt, tools and model', () => {
    const subs = buildSubagents()
    for (const def of Object.values(subs)) {
      expect(def.description.length).toBeGreaterThan(0)
      expect(def.prompt.length).toBeGreaterThan(0)
      expect(Array.isArray(def.tools)).toBe(true)
      expect(def.model).toBe('sonnet')
    }
  })

  it('wires the researcher with web tools', () => {
    const r = buildSubagents().researcher
    expect(r.tools).toEqual(expect.arrayContaining(['WebSearch', 'WebFetch', 'Read']))
  })

  it('lets the analyst run Python via Bash', () => {
    expect(buildSubagents().analyst.tools).toContain('Bash')
  })

  it('gives the automator the flow tools', () => {
    expect(buildSubagents().automator.tools).toEqual(
      expect.arrayContaining(['mcp__aex__create_flow', 'mcp__aex__run_flow']),
    )
  })

  it('returns a fresh object each call (no shared mutable state)', () => {
    expect(buildSubagents()).not.toBe(buildSubagents())
  })
})
