import { ExternalLink } from 'lucide-react'
import type { CellProps } from '../types'

export function UrlCell({ value, isEditing, editValue, onEditChange, onCommit, onCancel }: CellProps) {
  if (isEditing) {
    return (
      <input
        autoFocus
        type="url"
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

  const url = String(value)
  if (!url) return <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>-</span>

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 13,
        color: 'var(--accent)',
        textDecoration: 'none',
        overflow: 'hidden',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {url.replace(/^https?:\/\//, '')}
      </span>
      <ExternalLink size={11} style={{ flexShrink: 0 }} />
    </a>
  )
}
