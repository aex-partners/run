import { Link2 } from 'lucide-react'
import type { CellProps } from '../types'

export function RelationshipCell({ value }: CellProps) {
  const displayValue = String(value)
  if (!displayValue) return <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>-</span>

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: 'var(--accent-light)',
      border: '1px solid var(--accent-border)',
      borderRadius: 4,
      padding: '2px 8px',
      fontSize: 12,
      color: 'var(--accent)',
      fontWeight: 500,
      cursor: 'pointer',
    }}>
      <Link2 size={11} />
      {displayValue}
    </span>
  )
}
