import { describe, it, expect } from 'vitest'
import { getDocsManifest, getDocPage, DOC_SLUGS } from './docsContent'

describe('docsContent', () => {
  it('manifest is in reading order and covers every slug', () => {
    const manifest = getDocsManifest()
    expect(manifest.map((m) => m.slug)).toEqual([
      'getting-started',
      'chat-with-eric',
      'your-data',
      'tasks-and-automations',
      'files-and-email',
    ])
    expect(DOC_SLUGS).toEqual(manifest.map((m) => m.slug))
  })

  it('every manifest entry carries a title for both languages', () => {
    for (const entry of getDocsManifest()) {
      expect(entry.title.en.length).toBeGreaterThan(0)
      expect(entry.title['pt-BR'].length).toBeGreaterThan(0)
    }
  })

  it('loads a page for both languages', () => {
    expect(getDocPage('getting-started', 'en')).toBeTruthy()
    expect(getDocPage('getting-started', 'pt-BR')).toBeTruthy()
  })

  it('strips the language-switcher header line and its blank line', () => {
    const en = getDocPage('getting-started', 'en') as string
    expect(en).not.toContain('**English**')
    expect(en).not.toContain('[Português]')
    expect(en.trimStart().startsWith('#')).toBe(true)
  })

  it('strips the language-switcher header line for pt-BR', () => {
    const pt = getDocPage('getting-started', 'pt-BR') as string
    expect(pt).not.toContain('[English]')
    expect(pt.trimStart().startsWith('#')).toBe(true)
  })

  it('manifest title for getting-started matches the real H1', () => {
    const title = getDocsManifest()[0].title.en
    expect(title).toBe('Getting started with RUN')
  })

  it('returns null for an unknown slug or language', () => {
    expect(getDocPage('does-not-exist', 'en')).toBeNull()
    // @ts-expect-error invalid lang at runtime
    expect(getDocPage('getting-started', 'fr')).toBeNull()
  })
})
