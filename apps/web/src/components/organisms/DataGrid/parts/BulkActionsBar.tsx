import { Trash2, Copy, ArrowRight, Download, X } from 'lucide-react'

interface BulkActionsBarProps {
  selectedCount: number
  onDelete?: () => void
  onDuplicate?: () => void
  onExport?: () => void
  onClear: () => void
}

export function BulkActionsBar({
  selectedCount,
  onDelete,
  onDuplicate,
  onExport,
  onClear,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  const actionBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: 'var(--text)',
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        zIndex: 50,
        animation: 'bulkSlideUp 0.15s ease-out',
      }}
    >
      <style>{`
        @keyframes bulkSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <span style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--accent)',
        padding: '4px 10px',
        background: 'var(--accent-light)',
        borderRadius: 6,
        whiteSpace: 'nowrap',
      }}>
        {selectedCount} selected
      </span>

      {onDelete && (
        <button onClick={onDelete} style={{ ...actionBtnStyle, color: 'var(--danger)' }}>
          <Trash2 size={13} /> Delete
        </button>
      )}
      {onDuplicate && (
        <button onClick={onDuplicate} style={actionBtnStyle}>
          <Copy size={13} /> Duplicate
        </button>
      )}
      {onExport && (
        <button onClick={onExport} style={actionBtnStyle}>
          <Download size={13} /> Export
        </button>
      )}

      <button
        onClick={onClear}
        style={{
          ...actionBtnStyle,
          border: 'none',
          background: 'none',
          color: 'var(--text-muted)',
          padding: '6px 4px',
        }}
        aria-label="Clear selection"
      >
        <X size={14} />
      </button>
    </div>
  )
}
