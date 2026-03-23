import React from 'react'
import { useTranslation } from 'react-i18next'
import * as Collapsible from '@radix-ui/react-collapsible'
import { Database, ExternalLink, ChevronRight } from 'lucide-react'
import { Badge } from '../../atoms/Badge/Badge'

export interface Source {
  id: string
  name: string
  description?: string
  url?: string
}

export interface SourcesProps {
  sources: Source[]
  defaultOpen?: boolean
}

export function Sources({ sources, defaultOpen = false }: SourcesProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'inherit',
            borderRadius: 6,
          }}
        >
          <span>{t('sources.title')}</span>
          <Badge variant="neutral" size="sm">{sources.length}</Badge>
          <ChevronRight
            size={12}
            style={{
              transition: 'transform 0.15s',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content>
        <div
          style={{
            marginTop: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {sources.map((source) => (
            <div
              key={source.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                background: 'var(--surface-2)',
              }}
            >
              <Database size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4 }}>
                  {source.name}
                </div>
                {source.description && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {source.description}
                  </div>
                )}
              </div>
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', display: 'flex', flexShrink: 0, marginTop: 2 }}
                  aria-label={`Open ${source.name}`}
                >
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export default Sources
