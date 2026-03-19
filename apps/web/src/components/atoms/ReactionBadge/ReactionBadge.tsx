import React from 'react'

export interface ReactionBadgeProps {
  emoji: string
  count: number
  reacted: boolean
  onClick?: () => void
}

export function ReactionBadge({ emoji, count, reacted, onClick }: ReactionBadgeProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 13,
        lineHeight: 1.4,
        cursor: 'pointer',
        border: `1px solid ${reacted ? 'var(--accent-border)' : 'var(--border)'}`,
        background: reacted ? 'var(--accent-light)' : 'var(--surface-2)',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-border)'
      }}
      onMouseLeave={(e) => {
        if (!reacted) {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
        }
      }}
    >
      <span style={{ fontSize: 14 }}>{emoji}</span>
      <span style={{ fontSize: 12, color: reacted ? 'var(--accent)' : 'var(--text-muted)', fontWeight: reacted ? 600 : 400 }}>
        {count}
      </span>
    </button>
  )
}

export default ReactionBadge
