import { describe, it, expect } from 'vitest'
import {
  classifyTool,
  normalizeToolName,
  READ_ONLY_TOOLS,
  MUTATING_TOOLS,
  DEFAULT_ALLOWED_TOOLS,
} from '@/contexts/assistant/domain/ToolClass'

describe('ToolClass.normalizeToolName', () => {
  it('strips the mcp__aex__ prefix', () => {
    expect(normalizeToolName('mcp__aex__create_entity')).toBe('create_entity')
  })

  it('leaves a bare name untouched', () => {
    expect(normalizeToolName('query')).toBe('query')
    expect(normalizeToolName('Read')).toBe('Read')
  })

  it('only strips a leading prefix, not an embedded one', () => {
    expect(normalizeToolName('foo_mcp__aex__bar')).toBe('foo_mcp__aex__bar')
  })
})

describe('ToolClass.classifyTool', () => {
  it('classifies a known read-only tool by bare name', () => {
    expect(classifyTool('query')).toBe('read-only')
    expect(classifyTool('list_entities')).toBe('read-only')
    expect(classifyTool('Read')).toBe('read-only')
  })

  it('classifies a known read-only tool reported with the MCP prefix', () => {
    expect(classifyTool('mcp__aex__query')).toBe('read-only')
  })

  it('treats read_email as read-only despite its read-mark side effect', () => {
    expect(classifyTool('read_email')).toBe('read-only')
  })

  it('classifies a known mutating tool', () => {
    expect(classifyTool('create_entity')).toBe('mutating')
    expect(classifyTool('mcp__aex__delete_record')).toBe('mutating')
    expect(classifyTool('send_email')).toBe('mutating')
  })

  it('fails safe: an unknown tool is mutating', () => {
    expect(classifyTool('totally_unknown_tool')).toBe('mutating')
  })

  it('honours a read-only hint for an unknown (dynamic piece) tool', () => {
    expect(classifyTool('piece_custom_thing', { readOnlyHint: true })).toBe('read-only')
  })

  it('falls back to mutating when the hint is false or absent', () => {
    expect(classifyTool('piece_custom_thing', { readOnlyHint: false })).toBe('mutating')
    expect(classifyTool('piece_custom_thing')).toBe('mutating')
  })

  it('lets the explicit lists win over a hint', () => {
    // A hint can never demote a known mutating tool to read-only.
    expect(classifyTool('create_entity', { readOnlyHint: true })).toBe('mutating')
    // ...and a known read-only tool stays read-only regardless of a false hint.
    expect(classifyTool('query', { readOnlyHint: false })).toBe('read-only')
  })
})

describe('ToolClass sets', () => {
  it('keeps READ_ONLY and MUTATING disjoint', () => {
    for (const t of READ_ONLY_TOOLS) {
      expect(MUTATING_TOOLS.has(t)).toBe(false)
    }
  })

  it('exposes the expected core membership', () => {
    expect(READ_ONLY_TOOLS.has('query')).toBe(true)
    expect(READ_ONLY_TOOLS.has('Read')).toBe(true)
    expect(MUTATING_TOOLS.has('create_entity')).toBe(true)
    expect(MUTATING_TOOLS.has('delete_record')).toBe(true)
  })

  it('omits Bash/Write/Edit from the default allow-list (RCE surface)', () => {
    expect(DEFAULT_ALLOWED_TOOLS).not.toContain('Bash')
    expect(DEFAULT_ALLOWED_TOOLS).not.toContain('Write')
    expect(DEFAULT_ALLOWED_TOOLS).not.toContain('Edit')
    expect(DEFAULT_ALLOWED_TOOLS).toContain('mcp__aex__*')
  })
})
