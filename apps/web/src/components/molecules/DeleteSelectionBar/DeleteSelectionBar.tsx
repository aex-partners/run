import React from 'react'
import { X, Trash2 } from 'lucide-react'
import { t } from '../../../locales/en'

export interface DeleteSelectionBarProps {
  selectedCount: number
  onCancel: () => void
  onDelete: () => void
}

export function DeleteSelectionBar({ selectedCount, onCancel, onDelete }: DeleteSelectionBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        height: 52,
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <button
        onClick={onCancel}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 4,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label={t.cancel}
      >
        <X size={18} />
      </button>

      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>
        {t.chat.contextMenu.delete.selected(selectedCount)}
      </span>

      <button
        onClick={onDelete}
        disabled={selectedCount === 0}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 8,
          borderRadius: 8,
          border: 'none',
          cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
          color: selectedCount === 0 ? 'var(--text-muted)' : 'var(--danger)',
          background: 'none',
        }}
        aria-label={t.chat.contextMenu.delete.label}
      >
        <Trash2 size={20} />
      </button>
    </div>
  )
}

export default DeleteSelectionBar
