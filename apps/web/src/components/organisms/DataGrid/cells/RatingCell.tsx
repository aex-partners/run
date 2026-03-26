import { Star } from 'lucide-react'
import type { CellProps } from '../types'

export function RatingCell({ column, value, onDirectCommit }: CellProps) {
  const max = column.maxRating ?? 5
  const current = typeof value === 'number' ? value : Number(value) || 0

  return (
    <span style={{ display: 'inline-flex', gap: 2, cursor: 'pointer' }}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < current ? 'var(--accent)' : 'none'}
          stroke={i < current ? 'var(--accent)' : 'var(--border)'}
          style={{ cursor: 'pointer' }}
          onClick={() => {
            const newValue = i + 1 === current ? 0 : i + 1
            onDirectCommit?.(newValue)
          }}
        />
      ))}
    </span>
  )
}
