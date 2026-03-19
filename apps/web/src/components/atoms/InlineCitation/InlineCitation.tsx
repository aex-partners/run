import React from 'react'
import * as HoverCard from '@radix-ui/react-hover-card'
import { ExternalLink } from 'lucide-react'

export interface InlineCitationProps {
  index: number
  title: string
  url?: string
  quote?: string
}

export function InlineCitation({ index, title, url, quote }: InlineCitationProps) {
  return (
    <HoverCard.Root openDelay={200} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <button
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'inherit',
            color: 'var(--accent)',
            background: 'var(--accent-light)',
            border: 'none',
            borderRadius: 9,
            cursor: 'pointer',
            verticalAlign: 'middle',
            lineHeight: 1,
          }}
        >
          {index}
        </button>
      </HoverCard.Trigger>

      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="center"
          sideOffset={6}
          style={{
            width: 280,
            padding: 12,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 1000,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: quote || url ? 6 : 0, lineHeight: 1.4 }}>
            {title}
          </div>

          {quote && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                marginBottom: url ? 8 : 0,
                borderLeft: '2px solid var(--border)',
                paddingLeft: 8,
                fontStyle: 'italic',
              }}
            >
              {quote}
            </div>
          )}

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: 'var(--accent)',
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={12} />
              {url}
            </a>
          )}

          <HoverCard.Arrow style={{ fill: 'var(--surface)' }} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}

export default InlineCitation
