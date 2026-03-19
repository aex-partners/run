import type { GridRow, GridColumn } from '../DataGrid/types'
import { CalendarEvent } from './CalendarEvent'

interface CalendarDayProps {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  events: { row: GridRow; rowId: string }[]
  columns: GridColumn[]
  idCol: string
  onEventClick?: (rowId: string) => void
}

export function CalendarDay({ date, isCurrentMonth, isToday, events, columns, idCol, onEventClick }: CalendarDayProps) {
  return (
    <div style={{
      minHeight: 80,
      padding: 4,
      borderRight: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      background: isCurrentMonth ? 'var(--surface)' : 'var(--surface-2)',
      opacity: isCurrentMonth ? 1 : 0.5,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: isToday ? 700 : 400,
        color: isToday ? 'var(--accent)' : 'var(--text-muted)',
        marginBottom: 4,
        display: 'flex',
        justifyContent: 'flex-end',
      }}>
        {isToday ? (
          <span style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {date.getDate()}
          </span>
        ) : (
          date.getDate()
        )}
      </div>
      {events.slice(0, 3).map(({ row, rowId }) => (
        <CalendarEvent
          key={rowId}
          row={row}
          rowId={rowId}
          columns={columns}
          idCol={idCol}
          onClick={onEventClick}
        />
      ))}
      {events.length > 3 && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '0 4px' }}>
          +{events.length - 3} more
        </div>
      )}
    </div>
  )
}
