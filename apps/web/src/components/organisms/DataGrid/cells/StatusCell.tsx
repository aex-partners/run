import type { CellProps } from '../types'

export function StatusCell({ column, value }: CellProps) {
  const color = column.statusColors?.[String(value)] || '#6b7280'
  return (
    <span style={{
      background: color,
      color: '#fff',
      borderRadius: 20,
      padding: '4px 12px',
      fontSize: 12,
      fontWeight: 600,
      display: 'inline-block',
      textAlign: 'center',
      whiteSpace: 'nowrap',
    }}>
      {String(value)}
    </span>
  )
}
