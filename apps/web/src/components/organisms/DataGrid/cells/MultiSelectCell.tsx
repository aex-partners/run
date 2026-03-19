import type { CellProps } from '../types'

export function MultiSelectCell({ column, value }: CellProps) {
  const options = column.options ?? []
  const selectedValues = String(value).split(',').map(v => v.trim()).filter(Boolean)
  const selectedOptions = selectedValues
    .map(v => options.find(o => o.value === v))
    .filter(Boolean)

  if (selectedOptions.length === 0) {
    return <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>-</span>
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {selectedOptions.map(opt => (
        <span
          key={opt!.value}
          style={{
            background: opt!.color ? `${opt!.color}20` : 'var(--surface-2)',
            color: opt!.color ?? 'var(--text)',
            border: `1px solid ${opt!.color ?? 'var(--border)'}`,
            borderRadius: 12,
            padding: '1px 8px',
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {opt!.label}
        </span>
      ))}
    </div>
  )
}
