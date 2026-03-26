import type { CellProps } from '../types'

export function RollupCell({ column, value }: CellProps) {
  const numValue = typeof value === 'number' ? value : Number(value)
  const displayValue = Number.isNaN(numValue) ? String(value) : numValue.toLocaleString('en-US')
  const rollupFn = column.rollupFunction

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {displayValue}
      {rollupFn && (
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          background: 'var(--border)',
          color: 'var(--text-muted)',
          borderRadius: 3,
          padding: '1px 5px',
        }}>
          {rollupFn}
        </span>
      )}
    </span>
  )
}
