import { Clock, User } from 'lucide-react'
import type { CellProps } from '../types'

export function SystemCell({ column, value }: CellProps) {
  const displayValue = String(value)
  const isTimestamp = column.type === 'created_at' || column.type === 'updated_at'
  const Icon = isTimestamp ? Clock : User

  let formatted = displayValue
  if (isTimestamp && displayValue) {
    const d = new Date(displayValue)
    if (!Number.isNaN(d.getTime())) {
      formatted = d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 12,
      color: 'var(--text-muted)',
    }}>
      <Icon size={12} style={{ flexShrink: 0 }} />
      {formatted}
    </span>
  )
}
