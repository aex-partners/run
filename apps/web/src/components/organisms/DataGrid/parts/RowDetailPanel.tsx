import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { GridColumn, GridRow } from '../types'
import { CellRenderer } from '../cells/CellRenderer'

interface RowDetailPanelProps {
  row: GridRow | null
  rowId: string
  columns: GridColumn[]
  onClose: () => void
  onCellEdit?: (rowId: string, colId: string, value: string | number | boolean) => void
}

export function RowDetailPanel({ row, rowId, columns, onClose, onCellEdit: _onCellEdit }: RowDetailPanelProps) {
  const { t } = useTranslation()
  if (!row) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 400,
        maxWidth: '100%',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        animation: 'detailSlideIn 0.15s ease-out',
      }}
    >
      <style>{`
        @keyframes detailSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {String(row[columns[0]?.id] ?? rowId)}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
            display: 'flex',
            color: 'var(--text-muted)',
          }}
          aria-label={t('database.closeDetailPanel')}
        >
          <X size={16} />
        </button>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 12,
        }}>
          Fields
        </div>

        {columns.map(col => (
          <div
            key={col.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '8px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{
              width: 100,
              flexShrink: 0,
              fontSize: 12,
              color: 'var(--text-muted)',
              fontWeight: 500,
              paddingTop: 2,
            }}>
              {col.label}
            </span>
            <div style={{ flex: 1, fontSize: 13 }}>
              <CellRenderer
                column={col}
                value={row[col.id] ?? ''}
                rowId={rowId}
                isEditing={false}
                editValue=""
                onEditChange={() => {}}
                onCommit={() => {}}
                onCancel={() => {}}
              />
            </div>
          </div>
        ))}

        {/* Placeholder sections */}
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginTop: 24,
          marginBottom: 12,
        }}>
          Comments
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
          No comments yet.
        </div>

        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginTop: 24,
          marginBottom: 12,
        }}>
          Activity
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
          No activity recorded.
        </div>
      </div>
    </div>
  )
}
