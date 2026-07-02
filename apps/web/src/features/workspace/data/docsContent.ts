// Bundles the user guide markdown (repo-root docs/user/{en,pt-BR}/*.md) into the
// web build at compile time. No runtime fetch, no API route. Exposes an ordered
// manifest and a cleaned-markdown getter for the in-app docs viewer.

export type DocLang = 'en' | 'pt-BR'

/** Page slugs in reading order. Mirrors the file names under docs/user/<lang>/. */
export const DOC_SLUGS = [
  'getting-started',
  'chat-with-eric',
  'your-data',
  'tasks-and-automations',
  'files-and-email',
] as const

export type DocSlug = (typeof DOC_SLUGS)[number]

export interface DocManifestEntry {
  slug: DocSlug
  title: Record<DocLang, string>
}

// Eager raw glob: every match becomes a string at build time. Keys are paths
// relative to this file, e.g. '../../../../../../docs/user/en/getting-started.md'.
const RAW = import.meta.glob('../../../../../../docs/user/{en,pt-BR}/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Map a (slug, lang) pair to its raw markdown, or undefined if not bundled. */
function rawFor(slug: string, lang: DocLang): string | undefined {
  const suffix = `/docs/user/${lang}/${slug}.md`
  const key = Object.keys(RAW).find((k) => k.endsWith(suffix))
  return key ? RAW[key] : undefined
}

/** First markdown H1 ("# Title") in the source, trimmed; '' when absent. */
function parseTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+?)\s*$/m)
  return match ? match[1].trim() : ''
}

/**
 * Remove the in-file language-switcher header so the bundled toggle owns
 * language switching. The switcher sits just below the H1 heading.
 * Drops the switcher line plus one trailing blank line.
 */
function stripSwitcher(markdown: string): string {
  const lines = markdown.split('\n')
  let i = 0
  while (i < lines.length && lines[i].trim() === '') i += 1
  // Step past the H1 heading.
  if (lines[i]?.startsWith('# ')) {
    i += 1
    while (i < lines.length && lines[i].trim() === '') i += 1
  }
  const line = lines[i] ?? ''
  if (line.includes('**English**') || line.includes('[English]')) {
    lines.splice(i, 1)
    if (lines[i] !== undefined && lines[i].trim() === '') lines.splice(i, 1)
  }
  return lines.join('\n').trimStart()
}

/** Ordered manifest with per-language titles read from each file's H1. */
export function getDocsManifest(): DocManifestEntry[] {
  return DOC_SLUGS.map((slug) => {
    const en = rawFor(slug, 'en')
    const pt = rawFor(slug, 'pt-BR')
    return {
      slug,
      title: {
        en: en ? parseTitle(stripSwitcher(en)) : slug,
        'pt-BR': pt ? parseTitle(stripSwitcher(pt)) : slug,
      },
    }
  })
}

/** Cleaned markdown for a page, or null when the slug/lang is not bundled. */
export function getDocPage(slug: string, lang: DocLang): string | null {
  const raw = rawFor(slug, lang)
  if (!raw) return null
  return stripSwitcher(raw)
}
