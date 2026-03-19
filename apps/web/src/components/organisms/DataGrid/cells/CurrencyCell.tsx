import type { CellProps } from '../types'

export function CurrencyCell({ column, value, isEditing, editValue, onEditChange, onCommit, onCancel }: CellProps) {
  if (isEditing) {
    return (
      <input
        autoFocus
        value={editValue}
        onChange={(e) => onEditChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit()
          if (e.key === 'Escape') onCancel()
        }}
        style={{
          width: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--accent)',
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 13,
          color: 'var(--text)',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
    )
  }

  const num = typeof value === 'number' ? value : parseFloat(String(value))
  const formatted = isNaN(num) ? String(value) : new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: column.currencyCode || 'USD',
  }).format(num)

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, display: 'block', textAlign: 'right' }}>
      {formatted}
    </span>
  )
}
