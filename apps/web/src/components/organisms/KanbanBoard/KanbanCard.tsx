import type { GridColumn, GridRow } from '../DataGrid/types'

interface KanbanCardProps {
  row: GridRow
  rowId: string
  columns: GridColumn[]
  idCol: string
  onClick?: (rowId: string) => void
}

export function KanbanCard({ row, rowId, columns, idCol, onClick }: KanbanCardProps) {
  const titleCol = columns.find(c => c.id !== idCol && c.type === 'text')
  const displayCols = columns.filter(c => c.id !== idCol && c.type !== 'status' && c.type !== 'select')

  return (
    <div
      onClick={() => onClick?.(rowId)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'box-shadow 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
        {titleCol ? String(row[titleCol.id] ?? '') : String(row[idCol] ?? rowId)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {String(row[idCol] ?? rowId)}
      </div>
      {displayCols.slice(0, 3).map(col => {
        const val = row[col.id]
        if (!val || val === '') return null
        return (
          <div key={col.id} style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            <span style={{ fontWeight: 500 }}>{col.label}: </span>
            {String(val)}
          </div>
        )
      })}
    </div>
  )
}
