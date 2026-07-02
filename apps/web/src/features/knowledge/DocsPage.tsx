import { useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { DocsMarkdown } from './DocsMarkdown/DocsMarkdown'
import { getDocsManifest, getDocPage, type DocLang, type DocSlug } from '../workspace/data/docsContent'

function defaultLang(lng: string | undefined): DocLang {
  return lng?.startsWith('pt') ? 'pt-BR' : 'en'
}

export function DocsPage() {
  const { t, i18n } = useTranslation()
  const manifest = useMemo(() => getDocsManifest(), [])
  const [lang, setLang] = useState<DocLang>(() => defaultLang(i18n.language))
  const [slug, setSlug] = useState<DocSlug>(manifest[0].slug)

  const markdown = getDocPage(slug, lang)

  const onNavigate = useCallback((target: string, anchor?: string) => {
    const known = manifest.find((m) => m.slug === target)
    if (!known) {
      // Unknown slug: treat as external rather than breaking navigation.
      window.open(target, '_blank', 'noopener,noreferrer')
      return
    }
    setSlug(known.slug)
    if (anchor) {
      // Defer until the new page paints.
      requestAnimationFrame(() => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }, [manifest])

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--surface)' }}>
      <nav
        aria-label={t('docs.navLabel')}
        style={{
          width: 248, flexShrink: 0, borderRight: '1px solid var(--border)',
          padding: '20px 12px', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, padding: '0 8px' }}>
          {(['en', 'pt-BR'] as DocLang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              style={{
                flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, borderRadius: 6,
                border: '1px solid var(--border)', cursor: 'pointer',
                background: lang === l ? 'var(--accent)' : 'transparent',
                color: lang === l ? '#fff' : 'var(--text-muted)',
              }}
            >
              {l === 'en' ? 'EN' : 'PT'}
            </button>
          ))}
        </div>
        {manifest.map((entry) => (
          <button
            key={entry.slug}
            type="button"
            onClick={() => setSlug(entry.slug)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
              fontSize: 14, borderRadius: 6, border: 'none', cursor: 'pointer',
              marginBottom: 2,
              background: slug === entry.slug ? 'var(--surface-2)' : 'transparent',
              color: slug === entry.slug ? 'var(--text)' : 'var(--text-muted)',
              fontWeight: slug === entry.slug ? 600 : 400,
            }}
          >
            {entry.title[lang]}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
        {markdown ? (
          <DocsMarkdown markdown={markdown} onNavigate={onNavigate} />
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>{t('docs.notAvailable')}</p>
        )}
      </div>
    </div>
  )
}
