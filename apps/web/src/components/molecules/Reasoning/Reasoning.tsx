import React, { useEffect, useRef } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { Brain, ChevronRight } from 'lucide-react'

export interface ReasoningProps {
  content: string
  isStreaming?: boolean
  defaultOpen?: boolean
}

const pulsingKeyframes = `
@keyframes aex-reasoning-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`

function injectPulsingStyles() {
  if (typeof document === 'undefined') return
  const id = 'aex-reasoning-pulse'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = pulsingKeyframes
    document.head.appendChild(style)
  }
}

export function Reasoning({ content, isStreaming = false, defaultOpen = false }: ReasoningProps) {
  const [open, setOpen] = React.useState(defaultOpen || isStreaming)
  const prevStreaming = useRef(isStreaming)

  useEffect(() => {
    if (isStreaming && !prevStreaming.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync with streaming prop
      setOpen(true)
    } else if (!isStreaming && prevStreaming.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync with streaming prop
      setOpen(false)
    }
    prevStreaming.current = isStreaming
  }, [isStreaming])

  injectPulsingStyles()

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
          <Brain size={14} />
          <span>Thinking...</span>
          {isStreaming && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'aex-reasoning-pulse 1.4s ease-in-out infinite',
              }}
            />
          )}
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
            padding: '8px 12px',
            marginTop: 4,
            fontSize: 13,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            background: 'var(--surface-2)',
            borderRadius: 8,
            borderLeft: '2px solid var(--border)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {content}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export default Reasoning
