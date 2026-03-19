import { Sparkles } from 'lucide-react'
import type { CellProps } from '../types'

export function AICell({ value }: CellProps) {
  const displayValue = String(value)

  if (!displayValue || displayValue === 'undefined') {
    return (
      <button
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'linear-gradient(135deg, var(--accent-light), #f0f0ff)',
          border: '1px solid var(--accent-border)',
          borderRadius: 4,
          padding: '3px 10px',
          fontSize: 12,
          color: 'var(--accent)',
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Sparkles size={12} />
        Generate
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Sparkles size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <span style={{ fontSize: 13 }}>{displayValue}</span>
    </div>
  )
}
