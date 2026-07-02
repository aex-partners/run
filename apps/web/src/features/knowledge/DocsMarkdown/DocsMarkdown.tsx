import React, { useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { slugify, nodeText } from './slugify'

export interface DocsMarkdownProps {
  markdown: string
  /** Called for in-app navigation when a relative .md link is clicked. */
  onNavigate: (slug: string, anchor?: string) => void
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 28, fontWeight: 700, margin: '0 0 16px', letterSpacing: '-0.02em', scrollMarginTop: 16 },
  h2: { fontSize: 20, fontWeight: 600, margin: '28px 0 10px', letterSpacing: '-0.01em', scrollMarginTop: 16 },
  h3: { fontSize: 16, fontWeight: 600, margin: '20px 0 6px', scrollMarginTop: 16 },
  p: { margin: '0 0 14px', lineHeight: 1.7, color: 'var(--text)' },
  ul: { margin: '8px 0 14px', paddingLeft: 24 },
  ol: { margin: '8px 0 14px', paddingLeft: 24 },
  li: { marginBottom: 6, lineHeight: 1.7 },
  a: { color: 'var(--accent)', textDecoration: 'none' },
  code: {
    background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4, fontSize: 13,
    fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace",
  },
  pre: {
    background: 'var(--surface-2)', padding: '12px 16px', borderRadius: 8, overflow: 'auto',
    fontSize: 13, margin: '14px 0', border: '1px solid var(--border)',
  },
  blockquote: {
    borderLeft: '3px solid var(--accent)', paddingLeft: 14, margin: '14px 0',
    color: 'var(--text-muted)',
  },
  hr: { border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' },
  table: { borderCollapse: 'collapse', width: '100%', margin: '14px 0', fontSize: 14 },
  th: { borderBottom: '2px solid var(--border)', padding: '8px 12px', textAlign: 'left', fontWeight: 600 },
  td: { borderBottom: '1px solid var(--border)', padding: '8px 12px' },
}

export function DocsMarkdown({ markdown, onNavigate }: DocsMarkdownProps) {
  const components = useMemo(() => {
    const heading = (tag: 'h1' | 'h2' | 'h3') =>
      ({ children, ...props }: React.ComponentPropsWithoutRef<'h1'>) => {
        const id = slugify(nodeText(children))
        const Tag = tag
        return <Tag {...props} id={id} style={styles[tag]}>{children}</Tag>
      }
    return {
      h1: heading('h1'),
      h2: heading('h2'),
      h3: heading('h3'),
      p: ({ children, ...p }: React.ComponentPropsWithoutRef<'p'>) => <p {...p} style={styles.p}>{children}</p>,
      ul: ({ children, ...p }: React.ComponentPropsWithoutRef<'ul'>) => <ul {...p} style={styles.ul}>{children}</ul>,
      ol: ({ children, ...p }: React.ComponentPropsWithoutRef<'ol'>) => <ol {...p} style={styles.ol}>{children}</ol>,
      li: ({ children, ...p }: React.ComponentPropsWithoutRef<'li'>) => <li {...p} style={styles.li}>{children}</li>,
      code: ({ children, className, ...p }: React.ComponentPropsWithoutRef<'code'>) => {
        const isBlock = className?.startsWith('language-')
        if (isBlock) {
          return <pre style={styles.pre}><code {...p} style={{ fontFamily: 'monospace' }}>{children}</code></pre>
        }
        return <code {...p} style={styles.code}>{children}</code>
      },
      pre: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      blockquote: ({ children, ...p }: React.ComponentPropsWithoutRef<'blockquote'>) => (
        <blockquote {...p} style={styles.blockquote}>{children}</blockquote>
      ),
      hr: () => <hr style={styles.hr} />,
      table: ({ children, ...p }: React.ComponentPropsWithoutRef<'table'>) => <table {...p} style={styles.table}>{children}</table>,
      th: ({ children, ...p }: React.ComponentPropsWithoutRef<'th'>) => <th {...p} style={styles.th}>{children}</th>,
      td: ({ children, ...p }: React.ComponentPropsWithoutRef<'td'>) => <td {...p} style={styles.td}>{children}</td>,
      strong: ({ children }: { children: React.ReactNode }) => (
        <strong style={{ fontWeight: 600, color: 'var(--text)' }}>{children}</strong>
      ),
      a: ({ children, href = '', ...p }: React.ComponentPropsWithoutRef<'a'>) => {
        const external = /^https?:\/\//i.test(href)
        if (external) {
          return <a {...p} href={href} target="_blank" rel="noopener noreferrer" style={styles.a}>{children}</a>
        }
        const onClick = (e: React.MouseEvent) => {
          // Pure anchor: let the heading-id scroll happen natively.
          if (href.startsWith('#')) return
          const m = href.match(/(?:\.\/)?([^/#]+)\.md(?:#(.+))?$/)
          if (m) {
            e.preventDefault()
            onNavigate(m[1], m[2])
          }
        }
        return <a {...p} href={href} onClick={onClick} style={styles.a}>{children}</a>
      },
    }
  }, [onNavigate])

  return (
    <div style={{ maxWidth: 760 }}>
      <Markdown remarkPlugins={[remarkGfm]} components={components as React.ComponentProps<typeof Markdown>['components']}>{markdown}</Markdown>
    </div>
  )
}
