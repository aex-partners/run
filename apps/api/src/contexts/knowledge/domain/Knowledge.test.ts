import { describe, it, expect } from 'vitest'
import { Knowledge, KnowledgeProps } from '@/contexts/knowledge/domain/Knowledge'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const LATER = new Date('2024-01-02T00:00:00.000Z')

function create(props: Partial<KnowledgeProps> = {}): Knowledge {
  const r = Knowledge.create(
    KnowledgeId.of('k1'),
    {
      scope: 'company',
      category: 'client',
      title: 'Title',
      content: 'Content',
      createdBy: 'creator',
      ...props,
    },
    NOW,
  )
  if (!r.ok) throw new Error(`setup failed: ${r.error}`)
  return r.value
}

describe('Knowledge.create', () => {
  it('creates a valid entry and records KnowledgeCreated', () => {
    const r = Knowledge.create(
      KnowledgeId.of('k1'),
      { scope: 'company', category: 'client', title: '  T  ', content: '  C  ', createdBy: 'u' },
      NOW,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.title).toBe('T')
    expect(r.value.content).toBe('C')
    expect(r.value.pullEvents().map((e) => e.name)).toEqual(['knowledge.KnowledgeCreated'])
  })

  it('rejects an invalid scope', () => {
    const r = Knowledge.create(
      KnowledgeId.of('k1'),
      { scope: 'team', category: 'client', title: 'T', content: 'C', createdBy: 'u' },
      NOW,
    )
    expect(r.ok).toBe(false)
  })

  it('rejects an empty category, title, or content', () => {
    expect(Knowledge.create(KnowledgeId.of('k'), { scope: 'company', category: '  ', title: 'T', content: 'C', createdBy: 'u' }, NOW).ok).toBe(false)
    expect(Knowledge.create(KnowledgeId.of('k'), { scope: 'company', category: 'c', title: '  ', content: 'C', createdBy: 'u' }, NOW).ok).toBe(false)
    expect(Knowledge.create(KnowledgeId.of('k'), { scope: 'company', category: 'c', title: 'T', content: '  ', createdBy: 'u' }, NOW).ok).toBe(false)
  })
})

describe('Knowledge authority rules', () => {
  it('a company entry is visible/modifiable/deletable by anyone', () => {
    const k = create({ scope: 'company', createdBy: 'owner' })
    expect(k.isVisibleTo('someone-else')).toBe(true)
    expect(k.canBeModifiedBy('someone-else')).toBe(true)
    expect(k.canBeDeletedBy('someone-else')).toBe(true)
  })

  it('a personal entry is restricted to its creator', () => {
    const k = create({ scope: 'personal', createdBy: 'owner' })
    expect(k.isVisibleTo('owner')).toBe(true)
    expect(k.canBeModifiedBy('owner')).toBe(true)
    expect(k.canBeDeletedBy('owner')).toBe(true)
    expect(k.isVisibleTo('intruder')).toBe(false)
    expect(k.canBeModifiedBy('intruder')).toBe(false)
    expect(k.canBeDeletedBy('intruder')).toBe(false)
  })

  it('a personal entry with a null creator is private to no one', () => {
    const k = create({ scope: 'personal', createdBy: null })
    expect(k.isVisibleTo('anyone')).toBe(false)
  })
})

describe('Knowledge.update', () => {
  it('reports contentChanged true when title or content is touched', () => {
    const k = create()
    const r = k.update({ title: 'New' }, LATER)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.contentChanged).toBe(true)
    expect(k.updatedAt).toBe(LATER)
  })

  it('reports contentChanged false when only scope/category change', () => {
    const k = create()
    const r = k.update({ scope: 'personal', category: 'product' }, LATER)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.contentChanged).toBe(false)
    expect(k.scope.kind).toBe('personal')
  })

  it('rejects an empty title or content on update', () => {
    expect(create().update({ title: '  ' }, LATER).ok).toBe(false)
    expect(create().update({ content: '  ' }, LATER).ok).toBe(false)
  })

  it('rejects an invalid scope on update', () => {
    expect(create().update({ scope: 'bogus' }, LATER).ok).toBe(false)
  })
})

describe('Knowledge misc', () => {
  it('embeddingText joins title and content', () => {
    const k = create({ title: 'T', content: 'C' })
    expect(k.embeddingText()).toBe('T\nC')
  })

  it('markDeleted records KnowledgeDeleted', () => {
    const k = create()
    k.pullEvents()
    k.markDeleted(LATER)
    expect(k.pullEvents().map((e) => e.name)).toEqual(['knowledge.KnowledgeDeleted'])
  })

  it('rehydrate throws on a corrupt scope', () => {
    expect(() =>
      Knowledge.rehydrate(KnowledgeId.of('k'), {
        scope: 'corrupt',
        category: 'c',
        title: 'T',
        content: 'C',
        createdBy: 'u',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).toThrow()
  })
})
