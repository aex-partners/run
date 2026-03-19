import React from 'react'
import { X, ArrowRight } from 'lucide-react'
import { t } from '../../../locales/en'

export interface ForwardSelectionBarProps {
  selectedCount: number
  onCancel: () => void
  onForward: () => void
}

export function ForwardSelectionBar({ selectedCount, onCancel, onForward }: ForwardSelectionBarProps) {
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
        {t.chat.contextMenu.forward.selected(selectedCount)}
      </span>

      <button
        onClick={onForward}
        disabled={selectedCount === 0}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 16px',
          borderRadius: 8,
          border: 'none',
          cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'inherit',
          color: '#fff',
          background: selectedCount === 0 ? 'var(--border)' : 'var(--accent)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          if (selectedCount > 0) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-hover)'
        }}
        onMouseLeave={(e) => {
          if (selectedCount > 0) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)'
        }}
      >
        {t.chat.contextMenu.forward.action}
        <ArrowRight size={14} />
      </button>
    </div>
  )
}

export default ForwardSelectionBar
