import { ArrowUpRight } from 'lucide-react'
import type { CellProps } from '../types'

export function LookupCell({ value }: CellProps) {
  const displayValue = String(value)
  if (!displayValue) return <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>-</span>

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 13,
      color: 'var(--text-muted)',
    }}>
      {displayValue}
      <ArrowUpRight size={11} style={{ flexShrink: 0 }} />
    </span>
  )
}
