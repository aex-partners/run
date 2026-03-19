import type { GridColumn, AggregationType } from '../types'
import type { AggregationResult } from '../hooks/useAggregation'

interface AggregationRowProps {
  visibleColumns: GridColumn[]
  results: Record<string, AggregationResult>
  getColumnWidth?: (colId: string, defaultWidth: number) => number
}

function formatValue(result: AggregationResult): string {
  switch (result.type) {
    case 'count':
      return String(result.value)
    case 'avg':
      return result.value.toLocaleString('en-US', { maximumFractionDigits: 2 })
    default:
      return result.value.toLocaleString('en-US')
  }
}

function labelForType(type: AggregationType): string {
  switch (type) {
    case 'sum': return 'Sum'
    case 'avg': return 'Avg'
    case 'count': return 'Count'
    case 'min': return 'Min'
    case 'max': return 'Max'
  }
}

export function AggregationRow({ visibleColumns, results, getColumnWidth }: AggregationRowProps) {
  const hasResults = Object.keys(results).length > 0
  if (!hasResults) return null

  return (
    <div
      role="row"
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-2)',
      }}
    >
      <div style={{ width: 40, padding: '6px 12px', flexShrink: 0 }} />
      {visibleColumns.map(col => {
        const result = results[col.id]
        const width = getColumnWidth ? getColumnWidth(col.id, col.width || 120) : (col.width || 120)
        return (
          <div
            key={col.id}
            style={{
              width,
              minWidth: width,
              padding: '6px 12px',
              fontSize: 11,
              color: 'var(--text-muted)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {result && (
              <>
                <span>{labelForType(result.type)}</span>
                <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatValue(result)}
                </span>
              </>
            )}
          </div>
        )
      })}
      <div style={{ width: 40 }} />
    </div>
  )
}
