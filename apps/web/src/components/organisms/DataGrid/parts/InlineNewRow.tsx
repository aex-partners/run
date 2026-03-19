import { Plus } from 'lucide-react'
import type { GridColumn } from '../types'

interface InlineNewRowProps {
  visibleColumns: GridColumn[]
  idCol: string
  isActive: boolean
  values: Record<string, string>
  onStart: () => void
  onValueChange: (colId: string, value: string) => void
  onCommit: () => void
  onCancel: () => void
  getColumnWidth?: (colId: string, defaultWidth: number) => number
}

export function InlineNewRow({
  visibleColumns,
  idCol,
  isActive,
  values,
  onStart,
  onValueChange,
  onCommit,
  onCancel,
  getColumnWidth,
}: InlineNewRowProps) {
  if (!isActive) {
    return (
      <button
        onClick={onStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '9px 52px',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: 13,
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <Plus size={13} /> Record
      </button>
    )
  }

  return (
    <div
      role="row"
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        background: 'var(--accent-light)',
      }}
    >
      <div style={{ width: 40, padding: '9px 12px', flexShrink: 0 }} />
      {visibleColumns.map((col) => {
        const isEditable = col.id !== idCol && col.type !== 'badge' && col.type !== 'priority'
        const width = getColumnWidth ? getColumnWidth(col.id, col.width || 120) : (col.width || 120)
        return (
          <div
            key={col.id}
            style={{
              width,
              minWidth: width,
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isEditable ? (
              <input
                placeholder={col.label}
                value={values[col.id] ?? ''}
                onChange={(e) => onValueChange(col.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onCommit()
                  if (e.key === 'Escape') onCancel()
                }}
                style={{
                  width: '100%',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '3px 6px',
                  fontSize: 13,
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            ) : (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>-</span>
            )}
          </div>
        )
      })}
      <div style={{ width: 40, flexShrink: 0 }} />
      {/* Spacer to fill remaining width */}
      <div style={{ flex: 1, minWidth: 0 }} />
    </div>
  )
}
