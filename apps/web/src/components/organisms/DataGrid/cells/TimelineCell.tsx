import type { CellProps } from '../types'

export function TimelineCell({ value }: CellProps) {
  const parts = String(value).split('|')
  if (parts.length !== 2) return <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>-</span>

  const start = new Date(parts[0])
  const end = new Date(parts[1])
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return <span style={{ fontSize: 13 }}>{String(value)}</span>

  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const barWidth = Math.min(100, Math.max(20, totalDays * 2))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${barWidth}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {totalDays}d
      </span>
    </div>
  )
}
