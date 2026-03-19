import { useState, useMemo } from 'react'
import type { GridRow, SortConfig, SortDirection } from '../types'

export function useSort(
  rows: GridRow[],
  externalConfig?: SortConfig[],
  onSortChange?: (config: SortConfig[]) => void,
) {
  const [internalConfig, setInternalConfig] = useState<SortConfig[]>([])
  const sortConfig = externalConfig ?? internalConfig

  const updateConfig = (config: SortConfig[]) => {
    if (onSortChange) {
      onSortChange(config)
    } else {
      setInternalConfig(config)
    }
  }

  const toggleColumnSort = (columnId: string) => {
    const existing = sortConfig.find(s => s.columnId === columnId)
    if (!existing) {
      updateConfig([...sortConfig, { columnId, direction: 'asc' }])
    } else if (existing.direction === 'asc') {
      updateConfig(sortConfig.map(s =>
        s.columnId === columnId ? { ...s, direction: 'desc' as SortDirection } : s
      ))
    } else {
      updateConfig(sortConfig.filter(s => s.columnId !== columnId))
    }
  }

  const removeSort = (columnId: string) => {
    updateConfig(sortConfig.filter(s => s.columnId !== columnId))
  }

  const clearSort = () => {
    updateConfig([])
  }

  const sortedRows = useMemo(() => {
    if (sortConfig.length === 0) return rows

    return [...rows].sort((a, b) => {
      for (const { columnId, direction } of sortConfig) {
        const aVal = a[columnId]
        const bVal = b[columnId]
        const multiplier = direction === 'asc' ? 1 : -1

        if (aVal === bVal) continue
        if (aVal == null) return 1 * multiplier
        if (bVal == null) return -1 * multiplier

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * multiplier
        }

        return String(aVal).localeCompare(String(bVal)) * multiplier
      }
      return 0
    })
  }, [rows, sortConfig])

  const getSortDirection = (columnId: string): SortDirection | null => {
    return sortConfig.find(s => s.columnId === columnId)?.direction ?? null
  }

  const getSortIndex = (columnId: string): number => {
    const idx = sortConfig.findIndex(s => s.columnId === columnId)
    return idx === -1 ? -1 : idx
  }

  return {
    sortConfig,
    sortedRows,
    toggleColumnSort,
    removeSort,
    clearSort,
    getSortDirection,
    getSortIndex,
  }
}
