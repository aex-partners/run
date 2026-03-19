import React from 'react'
import { X, ArrowUp, ArrowDown } from 'lucide-react'
import type { SortConfig as SortConfigType, GridColumn } from '../types'

interface SortConfigProps {
  sortConfig: SortConfigType[]
  columns: GridColumn[]
  onRemove: (columnId: string) => void
  onClear: () => void
}

export function SortConfigPanel({ sortConfig, columns, onRemove, onClear }: SortConfigProps) {
  if (sortConfig.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 0',
    }}>
      {sortConfig.map(sort => {
        const col = columns.find(c => c.id === sort.columnId)
        if (!col) return null
        return (
          <div
            key={sort.columnId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              background: 'var(--accent-light)',
              border: '1px solid var(--accent-border)',
              borderRadius: 4,
              fontSize: 11,
              color: 'var(--accent)',
            }}
          >
            {sort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            <span>{col.label}</span>
            <button
              onClick={() => onRemove(sort.columnId)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                color: 'var(--accent)',
              }}
            >
              <X size={10} />
            </button>
          </div>
        )
      })}
      {sortConfig.length > 1 && (
        <button
          onClick={onClear}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 11,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Clear all
        </button>
      )}
    </div>
  )
}
