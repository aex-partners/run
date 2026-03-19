import React from 'react'
import { ArrowUp, ArrowDown, ChevronDown } from 'lucide-react'
import type { GridColumn, SortDirection } from '../types'
import { ColumnHeaderMenu } from './ColumnHeaderMenu'
import { ColumnResizeHandle } from './ColumnResizeHandle'

interface ColumnHeaderCellProps {
  column: GridColumn
  width: number
  sortDirection: SortDirection | null
  sortIndex: number
  multiSort: boolean
  onSort: () => void
  onSortAsc: () => void
  onSortDesc: () => void
  onHide: () => void
  onStartResize: (e: React.MouseEvent) => void
  onRename?: () => void
  onDelete?: () => void
  onInsertLeft?: () => void
  onInsertRight?: () => void
}

export function ColumnHeaderCell({
  column,
  width,
  sortDirection,
  sortIndex,
  multiSort,
  onSort,
  onSortAsc,
  onSortDesc,
  onHide,
  onStartResize,
  onRename,
  onDelete,
  onInsertLeft,
  onInsertRight,
}: ColumnHeaderCellProps) {
  return (
    <div
      role="columnheader"
      style={{
        width,
        minWidth: width,
        padding: '10px 12px',
        fontSize: 11,
        fontWeight: 600,
        color: sortDirection ? 'var(--accent)' : 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      <ColumnHeaderMenu
        column={column}
        sortDirection={sortDirection}
        onSortAsc={onSortAsc}
        onSortDesc={onSortDesc}
        onHide={onHide}
        onRename={onRename}
        onDelete={onDelete}
        onInsertLeft={onInsertLeft}
        onInsertRight={onInsertRight}
      >
        <div
          onClick={onSort}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flex: 1,
            overflow: 'hidden',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {column.label}
          </span>
          {sortDirection === 'asc' && <ArrowUp size={11} />}
          {sortDirection === 'desc' && <ArrowDown size={11} />}
          {!sortDirection && <ChevronDown size={11} />}
          {multiSort && sortIndex >= 0 && (
            <span style={{ fontSize: 9, opacity: 0.7 }}>{sortIndex + 1}</span>
          )}
        </div>
      </ColumnHeaderMenu>
      <ColumnResizeHandle onMouseDown={onStartResize} />
    </div>
  )
}
