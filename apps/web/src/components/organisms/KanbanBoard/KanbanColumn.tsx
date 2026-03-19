import * as ScrollArea from '@radix-ui/react-scroll-area'
import type { GridColumn, GridRow } from '../DataGrid/types'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnProps {
  title: string
  color: string
  rows: GridRow[]
  columns: GridColumn[]
  idCol: string
  getRowId: (row: GridRow) => string
  onCardClick?: (rowId: string) => void
}

export function KanbanColumn({
  title,
  color,
  rows,
  columns,
  idCol,
  getRowId,
  onCardClick,
}: KanbanColumnProps) {
  return (
    <div style={{
      minWidth: 280,
      maxWidth: 320,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface-2)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Column header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderBottom: `2px solid ${color}`,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        <span style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          background: 'var(--surface)',
          padding: '1px 6px',
          borderRadius: 10,
          border: '1px solid var(--border)',
        }}>
          {rows.length}
        </span>
      </div>

      {/* Cards */}
      <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport style={{ height: '100%', padding: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map(row => {
              const rowId = getRowId(row)
              return (
                <KanbanCard
                  key={rowId}
                  row={row}
                  rowId={rowId}
                  columns={columns}
                  idCol={idCol}
                  onClick={onCardClick}
                />
              )
            })}
            {rows.length === 0 && (
              <div style={{ padding: '16px 8px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                No items
              </div>
            )}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" style={{ width: 6 }}>
          <ScrollArea.Thumb style={{ background: 'var(--border)', borderRadius: 3 }} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  )
}
