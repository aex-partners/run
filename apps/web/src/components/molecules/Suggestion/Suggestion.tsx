import React from 'react'

export interface SuggestionProps {
  suggestions: string[]
  onSelect?: (text: string) => void
}

export function Suggestion({ suggestions, onSelect }: SuggestionProps) {
  if (suggestions.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 4,
      }}
    >
      {suggestions.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onSelect?.(text)}
          style={{
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'inherit',
            color: 'var(--accent)',
            background: 'var(--accent-light)',
            border: '1px solid var(--accent-border)',
            borderRadius: 20,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.background = 'var(--accent)'
            el.style.color = '#fff'
            el.style.borderColor = 'var(--accent)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.background = 'var(--accent-light)'
            el.style.color = 'var(--accent)'
            el.style.borderColor = 'var(--accent-border)'
          }}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export default Suggestion
