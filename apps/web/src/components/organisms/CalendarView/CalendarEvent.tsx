import type { GridRow, GridColumn } from '../DataGrid/types'

interface CalendarEventProps {
  row: GridRow
  rowId: string
  columns: GridColumn[]
  idCol: string
  onClick?: (rowId: string) => void
}

export function CalendarEvent({ row, rowId, columns, idCol, onClick }: CalendarEventProps) {
  const titleCol = columns.find(c => c.id !== idCol && c.type === 'text')
  const title = titleCol ? String(row[titleCol.id] ?? '') : String(row[idCol] ?? rowId)

  return (
    <button
      onClick={() => onClick?.(rowId)}
      style={{
        display: 'block',
        width: '100%',
        padding: '2px 6px',
        background: 'var(--accent-light)',
        border: '1px solid var(--accent-border)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: 4,
        fontSize: 11,
        color: 'var(--accent)',
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        marginBottom: 2,
      }}
    >
      {title}
    </button>
  )
}
