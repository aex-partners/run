import React, { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'

export interface ReactionBarProps {
  onReact: (emoji: string) => void
}

const defaultEmojis = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F64F}']

const extraEmojis = [
  '\u{1F525}', '\u2B50', '\u{1F44E}', '\u{1F440}', '\u{1F389}', '\u{1F4A1}',
  '\u2705', '\u274C', '\u{1F680}', '\u{1F4AA}', '\u{1F914}', '\u{1F44F}',
]

export function ReactionBar({ onReact }: ReactionBarProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [moreOpen])

  const handleClick = (emoji: string) => {
    onReact(emoji)
    setMoreOpen(false)
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        position: 'relative',
      }}
    >
      {defaultEmojis.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleClick(emoji)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            padding: '2px 4px',
            borderRadius: 6,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
        >
          {emoji}
        </button>
      ))}

      <div ref={moreRef} style={{ position: 'relative', display: 'flex' }}>
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 6,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
          aria-label="More reactions"
        >
          <Plus size={16} />
        </button>

        {moreOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: 6,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 2,
              padding: 6,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              zIndex: 10,
            }}
          >
            {extraEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleClick(emoji)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: '4px 6px',
                  borderRadius: 6,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ReactionBar
