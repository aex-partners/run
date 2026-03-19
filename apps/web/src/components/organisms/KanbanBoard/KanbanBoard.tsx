import { useMemo } from 'react'
import type { GridColumn, GridRow } from '../DataGrid/types'
import { KanbanColumn } from './KanbanColumn'

export interface KanbanBoardProps {
  columns: GridColumn[]
  rows: GridRow[]
  groupByColumn: string
  onCardClick?: (rowId: string) => void
}

export function KanbanBoard({ columns, rows, groupByColumn, onCardClick }: KanbanBoardProps) {
  const groupCol = columns.find(c => c.id === groupByColumn)
  const idCol = columns[0]?.id ?? 'id'
  const getRowId = (row: GridRow) => String(row[idCol] ?? row.id ?? '')

  const kanbanColumns = useMemo(() => {
    if (!groupCol) return []

    // If column has options (select/status), use those for columns
    if (groupCol.options && groupCol.options.length > 0) {
      return groupCol.options.map(opt => ({
        title: opt.label,
        color: opt.color ?? '#6b7280',
        rows: rows.filter(r => String(r[groupByColumn]) === opt.value),
      }))
    }

    // If column has statusColors, use those
    if (groupCol.statusColors) {
      return Object.entries(groupCol.statusColors).map(([status, color]) => ({
        title: status,
        color,
        rows: rows.filter(r => String(r[groupByColumn]) === status),
      }))
    }

    // Otherwise, group by distinct values
    const distinct = [...new Set(rows.map(r => String(r[groupByColumn] ?? '')))]
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280']
    return distinct.map((val, i) => ({
      title: val || '(empty)',
      color: colors[i % colors.length],
      rows: rows.filter(r => String(r[groupByColumn] ?? '') === val),
    }))
  }, [groupCol, rows, groupByColumn])

  if (!groupCol) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
        Select a column to group by for Kanban view.
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: 16,
      height: '100%',
      overflow: 'auto',
    }}>
      {kanbanColumns.map(col => (
        <KanbanColumn
          key={col.title}
          title={col.title}
          color={col.color}
          rows={col.rows}
          columns={columns}
          idCol={idCol}
          getRowId={getRowId}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  )
}
