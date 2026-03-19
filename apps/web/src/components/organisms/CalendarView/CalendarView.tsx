import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { GridRow, GridColumn } from '../DataGrid/types'
import { CalendarDay } from './CalendarDay'

export interface CalendarViewProps {
  columns: GridColumn[]
  rows: GridRow[]
  dateColumnId: string
  onEventClick?: (rowId: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Pad start of month
  const startDow = firstDay.getDay()
  for (let i = startDow - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i))
  }

  // Days of month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d))
  }

  // Pad end to complete last week
  while (days.length % 7 !== 0) {
    days.push(new Date(year, month + 1, days.length - lastDay.getDate() - startDow + 1))
  }

  return days
}

export function CalendarView({ columns, rows, dateColumnId, onEventClick }: CalendarViewProps) {
  const [viewDate, setViewDate] = useState(new Date())
  const idCol = columns[0]?.id ?? 'id'
  const getRowId = (row: GridRow) => String(row[idCol] ?? row.id ?? '')

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const today = new Date()

  const days = useMemo(() => getDaysInMonth(year, month), [year, month])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, { row: GridRow; rowId: string }[]>()
    rows.forEach(row => {
      const dateVal = row[dateColumnId]
      if (!dateVal) return
      // Handle timeline format (start|end) and plain date
      const dateStr = String(dateVal).split('|')[0]
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push({ row, rowId: getRowId(row) })
    })
    return map
  }, [rows, dateColumnId])

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))
  const goToday = () => setViewDate(new Date())

  const monthName = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 15, minWidth: 160, textAlign: 'center' }}>
          {monthName}
        </span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }}>
          <ChevronRight size={16} />
        </button>
        <button
          onClick={goToday}
          style={{
            marginLeft: 8,
            padding: '4px 10px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--surface)',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: 'var(--text)',
          }}
        >
          Today
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        {WEEKDAYS.map(day => (
          <div key={day} style={{
            padding: '6px 8px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textAlign: 'center',
            textTransform: 'uppercase',
            borderRight: '1px solid var(--border)',
          }}>
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((date, i) => {
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
            const isCurrentMonth = date.getMonth() === month
            const isToday = date.toDateString() === today.toDateString()
            const events = eventsByDate.get(key) ?? []

            return (
              <CalendarDay
                key={i}
                date={date}
                isCurrentMonth={isCurrentMonth}
                isToday={isToday}
                events={events}
                columns={columns}
                idCol={idCol}
                onEventClick={onEventClick}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
