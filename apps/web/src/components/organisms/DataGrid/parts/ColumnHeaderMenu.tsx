import React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  ArrowUp,
  ArrowDown,
  EyeOff,
  Pencil,
  Trash2,
  PlusCircle,
} from 'lucide-react'
import type { GridColumn, SortDirection } from '../types'

interface ColumnHeaderMenuProps {
  column: GridColumn
  sortDirection: SortDirection | null
  children: React.ReactNode
  onSortAsc: () => void
  onSortDesc: () => void
  onHide: () => void
  onRename?: () => void
  onDelete?: () => void
  onInsertLeft?: () => void
  onInsertRight?: () => void
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 12px',
  fontSize: 13,
  color: 'var(--text)',
  cursor: 'pointer',
  outline: 'none',
  borderRadius: 4,
  fontFamily: 'inherit',
  border: 'none',
  background: 'none',
  width: '100%',
}

export function ColumnHeaderMenu({
  column,
  sortDirection,
  children,
  onSortAsc,
  onSortDesc,
  onHide,
  onRename,
  onDelete,
  onInsertLeft,
  onInsertRight,
}: ColumnHeaderMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {children}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            zIndex: 100,
            minWidth: 180,
            padding: '4px 0',
          }}
        >
          <DropdownMenu.Item
            style={{
              ...menuItemStyle,
              color: sortDirection === 'asc' ? 'var(--accent)' : 'var(--text)',
            }}
            onSelect={onSortAsc}
          >
            <ArrowUp size={14} />
            Sort ascending
          </DropdownMenu.Item>
          <DropdownMenu.Item
            style={{
              ...menuItemStyle,
              color: sortDirection === 'desc' ? 'var(--accent)' : 'var(--text)',
            }}
            onSelect={onSortDesc}
          >
            <ArrowDown size={14} />
            Sort descending
          </DropdownMenu.Item>

          <DropdownMenu.Separator style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          <DropdownMenu.Item style={menuItemStyle} onSelect={onHide}>
            <EyeOff size={14} />
            Hide column
          </DropdownMenu.Item>

          {onRename && (
            <DropdownMenu.Item style={menuItemStyle} onSelect={onRename}>
              <Pencil size={14} />
              Rename
            </DropdownMenu.Item>
          )}

          {(onInsertLeft || onInsertRight) && (
            <>
              <DropdownMenu.Separator style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              {onInsertLeft && (
                <DropdownMenu.Item style={menuItemStyle} onSelect={onInsertLeft}>
                  <PlusCircle size={14} />
                  Insert left
                </DropdownMenu.Item>
              )}
              {onInsertRight && (
                <DropdownMenu.Item style={menuItemStyle} onSelect={onInsertRight}>
                  <PlusCircle size={14} />
                  Insert right
                </DropdownMenu.Item>
              )}
            </>
          )}

          {onDelete && (
            <>
              <DropdownMenu.Separator style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <DropdownMenu.Item style={{ ...menuItemStyle, color: 'var(--danger)' }} onSelect={onDelete}>
                <Trash2 size={14} />
                Delete column
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
