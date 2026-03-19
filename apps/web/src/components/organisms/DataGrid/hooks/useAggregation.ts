import { useMemo } from 'react'
import type { GridRow, GridColumn, AggregationType } from '../types'

export interface AggregationResult {
  columnId: string
  type: AggregationType
  value: number
}

export function useAggregation(
  rows: GridRow[],
  columns: GridColumn[],
  config: Record<string, AggregationType>,
) {
  const results = useMemo((): Record<string, AggregationResult> => {
    const output: Record<string, AggregationResult> = {}

    for (const [columnId, aggType] of Object.entries(config)) {
      const col = columns.find(c => c.id === columnId)
      if (!col) continue

      const values = rows
        .map(row => row[columnId])
        .filter(v => v != null && v !== '')
        .map(v => typeof v === 'number' ? v : parseFloat(String(v)))
        .filter(v => !isNaN(v))

      let value = 0
      switch (aggType) {
        case 'count':
          value = rows.filter(r => r[columnId] != null && r[columnId] !== '').length
          break
        case 'sum':
          value = values.reduce((s, v) => s + v, 0)
          break
        case 'avg':
          value = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
          break
        case 'min':
          value = values.length > 0 ? Math.min(...values) : 0
          break
        case 'max':
          value = values.length > 0 ? Math.max(...values) : 0
          break
      }

      output[columnId] = { columnId, type: aggType, value }
    }

    return output
  }, [rows, columns, config])

  return results
}
