import { useState, useRef, useEffect } from 'react'
import type { GridRow, RowGroup } from '../types'

export interface GridState {
  hoveredRow: string | null
  setHoveredRow: (id: string | null) => void
  editingCell: { rowId: string; colId: string } | null
  setEditingCell: (cell: { rowId: string; colId: string } | null) => void
  editValue: string
  setEditValue: (value: string) => void
  editedRows: Record<string, GridRow>
  setEditedRows: React.Dispatch<React.SetStateAction<Record<string, GridRow>>>
  filterActive: boolean
  setFilterActive: (active: boolean) => void
  filterText: string
  setFilterText: (text: string) => void
  columnsOpen: boolean
  setColumnsOpen: (open: boolean) => void
  hiddenColumns: Set<string>
  toggleColumn: (colId: string) => void
  internalSelected: Set<string>
  setInternalSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  deletedRowIds: Set<string>
  setDeletedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>
  rowMenuOpen: string | null
  setRowMenuOpen: (id: string | null) => void
  collapsedGroups: Set<string>
  toggleGroup: (groupId: string) => void
  columnsPopoverRef: React.RefObject<HTMLDivElement | null>
  rowMenuRef: React.RefObject<HTMLDivElement | null>
}

export function useGridState(
  selectedRowsProp: string[],
  groups: RowGroup[] | undefined,
  onToggleGroup?: (groupId: string) => void,
): GridState {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [editedRows, setEditedRows] = useState<Record<string, GridRow>>({})

  const [filterActive, setFilterActive] = useState(false)
  const [filterText, setFilterText] = useState('')

  const [columnsOpen, setColumnsOpen] = useState(false)
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())

  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set(selectedRowsProp))

  const [deletedRowIds, setDeletedRowIds] = useState<Set<string>>(new Set())
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null)

  const columnsPopoverRef = useRef<HTMLDivElement>(null)
  const rowMenuRef = useRef<HTMLDivElement>(null)

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set(
    (groups ?? []).filter(g => g.collapsed).map(g => g.id)
  ))

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) { next.delete(groupId) } else { next.add(groupId) }
      return next
    })
    onToggleGroup?.(groupId)
  }

  const toggleColumn = (colId: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev)
      if (next.has(colId)) { next.delete(colId) } else { next.add(colId) }
      return next
    })
  }

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (columnsPopoverRef.current && !columnsPopoverRef.current.contains(e.target as Node)) {
        setColumnsOpen(false)
      }
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) {
        setRowMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return {
    hoveredRow, setHoveredRow,
    editingCell, setEditingCell,
    editValue, setEditValue,
    editedRows, setEditedRows,
    filterActive, setFilterActive,
    filterText, setFilterText,
    columnsOpen, setColumnsOpen,
    hiddenColumns, toggleColumn,
    internalSelected, setInternalSelected,
    deletedRowIds, setDeletedRowIds,
    rowMenuOpen, setRowMenuOpen,
    collapsedGroups, toggleGroup,
    columnsPopoverRef, rowMenuRef,
  }
}
