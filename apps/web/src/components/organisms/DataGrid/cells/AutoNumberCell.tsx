import type { CellProps } from '../types'

export function AutoNumberCell({ value }: CellProps) {
  return (
    <span style={{
      fontSize: 13,
      fontFamily: 'monospace',
      color: 'var(--text-muted)',
    }}>
      #{String(value)}
    </span>
  )
}
