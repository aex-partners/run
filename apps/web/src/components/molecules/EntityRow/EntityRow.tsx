import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Badge } from '../../atoms/Badge/Badge'

export interface EntityCell {
  id?: string
  value: string | number
  type: 'text' | 'badge' | 'number' | 'date'
  badgeVariant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange'
}

export interface EntityRowProps {
  cells: EntityCell[]
  selected?: boolean
  onSelect?: (selected: boolean) => void
  onDelete?: () => void
}

export function EntityRow({ cells, selected = false, onSelect, onDelete }: EntityRowProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)

  const renderCell = (cell: EntityCell, index: number) => {
    if (cell.type === 'badge') {
      return (
        <Badge variant={cell.badgeVariant || 'neutral'}>
          {String(cell.value)}
        </Badge>
      )
    }
    if (cell.type === 'number') {
      return (
        <span style={{ fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {typeof cell.value === 'number' ? cell.value.toLocaleString('en-US') : cell.value}
        </span>
      )
    }
    if (cell.type === 'date') {
      return (
        <span style={{ fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {String(cell.value)}
        </span>
      )
    }
    return (
      <span
        style={{
          fontSize: 13,
          color: index === 0 ? 'var(--text-muted)' : 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {String(cell.value)}
      </span>
    )
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        borderBottom: '1px solid var(--border)',
        background: selected ? 'var(--accent-light)' : hovered ? 'var(--surface)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ width: 40, padding: '9px 12px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect?.(e.target.checked)}
          aria-label={t('database.selectRow')}
          style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
      </div>
      {cells.map((cell, i) => (
        <div
          key={cell.id ?? i}
          style={{
            flex: 1,
            padding: '9px 12px',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          {renderCell(cell, i)}
        </div>
      ))}
      <div style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {hovered && onDelete && (
          <button
            onClick={onDelete}
            title={t('delete')}
            aria-label={t('database.deleteRow')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-light)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

export default EntityRow
