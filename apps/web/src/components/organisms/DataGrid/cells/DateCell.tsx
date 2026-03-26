import type { CellProps } from '../types'

export function DateCell({ value, isEditing, editValue, onEditChange, onCommit, onCancel }: CellProps) {
  if (isEditing) {
    return (
      <input
        autoFocus
        type="date"
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

  const displayValue = String(value)
  let formatted = displayValue
  if (displayValue) {
    const d = new Date(displayValue)
    if (!Number.isNaN(d.getTime())) {
      formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }

  return <span style={{ fontSize: 13 }}>{formatted}</span>
}
