import { describe, it, expect } from 'vitest'
import { PieceToolset, InstalledPiece } from '@/contexts/plugins/domain/PieceToolset'
import { PieceMetadata, PieceProperty } from '@/contexts/plugins/domain/PieceMetadata'

describe('PieceToolset.classifyAction', () => {
  it('classifies read verbs as read-only', () => {
    expect(PieceToolset.classifyAction('list_contacts')).toBe(true)
    expect(PieceToolset.classifyAction('get_invoice')).toBe(true)
    expect(PieceToolset.classifyAction('search-orders')).toBe(true)
    expect(PieceToolset.classifyAction('fetch_data')).toBe(true)
    expect(PieceToolset.classifyAction('find_user')).toBe(true)
  })

  it('classifies mutating verbs as not read-only', () => {
    expect(PieceToolset.classifyAction('create_contact')).toBe(false)
    expect(PieceToolset.classifyAction('update_order')).toBe(false)
    expect(PieceToolset.classifyAction('send_email')).toBe(false)
  })

  it('fails closed: a mutating token anywhere overrides a read first verb', () => {
    expect(PieceToolset.classifyAction('find_or_create_contact')).toBe(false)
    expect(PieceToolset.classifyAction('get_and_delete_record')).toBe(false)
  })

  it('classifies on the first token only (non-read first verb is mutating)', () => {
    expect(PieceToolset.classifyAction('contact_list')).toBe(false)
  })

  it('returns false for an empty action name', () => {
    expect(PieceToolset.classifyAction('')).toBe(false)
  })
})

describe('PieceToolset.sanitizeName', () => {
  it('lowercases and replaces disallowed chars with underscore', () => {
    expect(PieceToolset.sanitizeName('Get Contact!')).toBe('get_contact_')
    expect(PieceToolset.sanitizeName('a.b-c')).toBe('a_b_c')
  })
})

describe('PieceToolset.pieceSlug', () => {
  it('drops @scope/ and piece- prefixes then sanitizes', () => {
    expect(PieceToolset.pieceSlug('@activepieces/piece-gmail')).toBe('gmail')
    expect(PieceToolset.pieceSlug('piece-slack')).toBe('slack')
    expect(PieceToolset.pieceSlug('@org/custom-thing')).toBe('custom_thing')
  })
})

describe('PieceToolset.propsToJsonSchema', () => {
  it('maps property types to JSON Schema and collects required', () => {
    const props: PieceProperty[] = [
      { name: 'title', type: 'SHORT_TEXT', required: true, displayName: 'Title' },
      { name: 'count', type: 'NUMBER', required: false },
      { name: 'flag', type: 'CHECKBOX', required: true },
    ]
    const schema = PieceToolset.propsToJsonSchema(props)
    expect(schema.type).toBe('object')
    expect(schema.properties).toEqual({
      title: { type: 'string', description: 'Title' },
      count: { type: 'number' },
      flag: { type: 'boolean' },
    })
    expect(schema.required).toEqual(['title', 'flag'])
  })

  it('omits required when no field is required', () => {
    const schema = PieceToolset.propsToJsonSchema([{ name: 'x', type: 'SHORT_TEXT', required: false }])
    expect(schema.required).toBeUndefined()
  })

  it('uses description over displayName when both present', () => {
    const schema = PieceToolset.propsToJsonSchema([
      { name: 'x', type: 'SHORT_TEXT', required: false, displayName: 'D', description: 'real desc' },
    ])
    expect((schema.properties as Record<string, { description?: string }>).x.description).toBe('real desc')
  })

  it('maps array and object families correctly', () => {
    const schema = PieceToolset.propsToJsonSchema([
      { name: 'tags', type: 'ARRAY', required: false },
      { name: 'meta', type: 'JSON', required: false },
    ])
    const props = schema.properties as Record<string, unknown>
    expect(props.tags).toEqual({ type: 'array', items: { type: 'string' } })
    expect(props.meta).toEqual({ type: 'object', additionalProperties: true })
  })
})

describe('PieceToolset.buildToolDescriptors', () => {
  const meta = (pieceName: string, actions: { name: string; props?: PieceProperty[] }[]): PieceMetadata => ({
    pieceName,
    displayName: pieceName,
    hasAuth: false,
    actions: actions.map((a) => ({ name: a.name, requireAuth: false, props: a.props ?? [] })),
    triggers: [],
  })

  it('prefixes tool names with the piece slug and classifies readOnly', () => {
    const pieces: InstalledPiece[] = [
      { pluginName: 'Gmail', pluginLogoUrl: null, meta: meta('@activepieces/piece-gmail', [{ name: 'send_email' }, { name: 'list_threads' }]) },
    ]
    const tools = PieceToolset.buildToolDescriptors(pieces)
    expect(tools.map((t) => t.name)).toEqual(['gmail_send_email', 'gmail_list_threads'])
    expect(tools[0]?.readOnly).toBe(false)
    expect(tools[1]?.readOnly).toBe(true)
    expect(tools[0]?.pieceName).toBe('@activepieces/piece-gmail')
    expect(tools[0]?.actionName).toBe('send_email')
  })

  it('de-duplicates colliding tool names with a numeric suffix', () => {
    const pieces: InstalledPiece[] = [
      { pluginName: 'A', pluginLogoUrl: null, meta: meta('piece-dup', [{ name: 'run' }]) },
      { pluginName: 'B', pluginLogoUrl: null, meta: meta('piece-dup', [{ name: 'run' }]) },
      { pluginName: 'C', pluginLogoUrl: null, meta: meta('piece-dup', [{ name: 'run' }]) },
    ]
    const names = PieceToolset.buildToolDescriptors(pieces).map((t) => t.name)
    expect(names).toEqual(['dup_run', 'dup_run_1', 'dup_run_2'])
    expect(new Set(names).size).toBe(3)
  })

  it('falls back to a synthesized description when the action has none', () => {
    const pieces: InstalledPiece[] = [
      { pluginName: 'A', pluginLogoUrl: null, meta: meta('piece-x', [{ name: 'do_thing' }]) },
    ]
    const tools = PieceToolset.buildToolDescriptors(pieces)
    expect(tools[0]?.description).toBe('piece-x / do_thing')
  })
})

describe('PieceMetadata lookups', () => {
  const meta: PieceMetadata = {
    pieceName: 'piece-x',
    displayName: 'X',
    hasAuth: false,
    actions: [{ name: 'a1', requireAuth: false, props: [] }],
    triggers: [{ name: 't1', requireAuth: false, props: [] }],
  }

  it('finds an action by name and returns undefined otherwise', () => {
    expect(PieceMetadata.findAction(meta, 'a1')?.name).toBe('a1')
    expect(PieceMetadata.findAction(meta, 'nope')).toBeUndefined()
  })

  it('finds a trigger by name and returns undefined otherwise', () => {
    expect(PieceMetadata.findTrigger(meta, 't1')?.name).toBe('t1')
    expect(PieceMetadata.findTrigger(meta, 'nope')).toBeUndefined()
  })
})
