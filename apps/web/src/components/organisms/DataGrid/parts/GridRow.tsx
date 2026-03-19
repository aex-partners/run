import React from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { GridColumn, GridRow as GridRowType } from '../types'
import { CellRenderer } from '../cells/CellRenderer'
import { COLUMN_TYPE_REGISTRY } from '../constants'

interface GridRowProps {
  row: GridRowType
  rowId: string
  visibleColumns: GridColumn[]
  idCol: string
  isSelected: boolean
  isHovered: boolean
  editingCell: { rowId: string; colId: string } | null
  editValue: string
  rowMenuOpen: boolean
  onHover: (id: string | null) => void
  onSelect: (rowId: string, checked: boolean) => void
  onCellClick: (rowId: string, col: GridColumn) => void
  onEditChange: (value: string) => void
  onEditCommit: (rowId: string, colId: string, col: GridColumn) => void
  onEditCancel: () => void
  onRowMenuToggle: (rowId: string) => void
  onEditRow: (rowId: string) => void
  onDeleteRow: (rowId: string) => void
  rowMenuRef?: React.Ref<HTMLDivElement>
  getColumnWidth?: (colId: string, defaultWidth: number) => number
}

export function GridRow({
  row,
  rowId,
  visibleColumns,
  idCol,
  isSelected,
  isHovered,
  editingCell,
  editValue,
  rowMenuOpen,
  onHover,
  onSelect,
  onCellClick,
  onEditChange,
  onEditCommit,
  onEditCancel,
  onRowMenuToggle,
  onEditRow,
  onDeleteRow,
  rowMenuRef,
  getColumnWidth,
}: GridRowProps) {
  return (
    <div
      role="row"
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        background: isSelected
          ? 'var(--accent-light)'
          : isHovered
          ? 'var(--surface)'
          : 'transparent',
        transition: 'background 0.1s',
        cursor: 'default',
        position: 'relative',
      }}
      onMouseEnter={() => onHover(rowId)}
      onMouseLeave={() => onHover(null)}
    >
      <div role="cell" style={{ width: 40, padding: '9px 12px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(rowId, e.target.checked)}
          aria-label="Select row"
          style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
      </div>
      {visibleColumns.map((col) => {
        const isEditableCol = col.id !== idCol && COLUMN_TYPE_REGISTRY[col.type]?.editable !== false
          && col.type !== 'badge' && col.type !== 'status' && col.type !== 'priority'
        const isEditing = editingCell?.rowId === rowId && editingCell?.colId === col.id
        const width = getColumnWidth ? getColumnWidth(col.id, col.width || 120) : (col.width || 120)
        return (
          <div
            key={col.id}
            role="cell"
            onClick={() => isEditableCol && onCellClick(rowId, col)}
            style={{
              width,
              minWidth: width,
              padding: '9px 12px',
              color: col.id === idCol ? 'var(--text-muted)' : 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
              cursor: isEditableCol ? 'text' : 'default',
            }}
          >
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
              <CellRenderer
                column={col}
                value={row[col.id] ?? ''}
                rowId={rowId}
                isEditing={isEditing}
                editValue={editValue}
                onEditChange={onEditChange}
                onCommit={() => onEditCommit(rowId, col.id, col)}
                onCancel={onEditCancel}
              />
            </div>
          </div>
        )
      })}

      {/* Row action menu */}
      <div
        role="cell"
        style={{
          width: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
        ref={rowMenuOpen ? rowMenuRef : undefined}
      >
        {isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRowMenuToggle(rowId)
            }}
            aria-label="Row actions"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
            }}
          >
            <MoreHorizontal size={14} />
          </button>
        )}
        {rowMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% - 4px)',
              right: 4,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
              zIndex: 50,
              minWidth: 140,
              padding: '4px 0',
            }}
          >
            <button
              onClick={() => onEditRow(rowId)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 14px',
                background: 'none',
                border: 'none',
                fontSize: 13,
                color: 'var(--text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              Edit row
            </button>
            <button
              onClick={() => onDeleteRow(rowId)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 14px',
                background: 'none',
                border: 'none',
                fontSize: 13,
                color: 'var(--danger)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-light)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              Delete row
            </button>
          </div>
        )}
      </div>
      {/* Spacer to fill remaining width */}
      <div style={{ flex: 1, minWidth: 0 }} />
    </div>
  )
}
