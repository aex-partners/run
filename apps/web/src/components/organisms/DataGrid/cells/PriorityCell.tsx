import { PRIORITY_COLORS } from '../constants'
import type { CellProps } from '../types'

export function PriorityCell({ value }: CellProps) {
  const dotColor = PRIORITY_COLORS[String(value)] || '#6b7280'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <span style={{ fontSize: 13 }}>{String(value)}</span>
    </div>
  )
}
