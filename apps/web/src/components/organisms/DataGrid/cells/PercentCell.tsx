import type { CellProps } from '../types'

export function PercentCell({ value, isEditing, editValue, onEditChange, onCommit, onCancel }: CellProps) {
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

  const numValue = typeof value === 'number' ? value : Number(value)
  const displayValue = Number.isNaN(numValue) ? String(value) : `${numValue}%`

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
      {displayValue}
    </span>
  )
}
