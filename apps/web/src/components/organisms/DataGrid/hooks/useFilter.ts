import { useState, useMemo } from 'react'
import type { GridRow, FilterCondition } from '../types'

export function useFilter(
  rows: GridRow[],
  externalConfig?: FilterCondition[],
  onFilterChange?: (config: FilterCondition[]) => void,
) {
  const [internalConfig, setInternalConfig] = useState<FilterCondition[]>([])
  const filterConfig = externalConfig ?? internalConfig

  const updateConfig = (config: FilterCondition[]) => {
    if (onFilterChange) {
      onFilterChange(config)
    } else {
      setInternalConfig(config)
    }
  }

  const addCondition = (condition: FilterCondition) => {
    updateConfig([...filterConfig, condition])
  }

  const removeCondition = (index: number) => {
    updateConfig(filterConfig.filter((_, i) => i !== index))
  }

  const clearConditions = () => {
    updateConfig([])
  }

  const filteredRows = useMemo(() => {
    if (filterConfig.length === 0) return rows

    return rows.filter(row => {
      return filterConfig.every(condition => {
        const val = row[condition.columnId]
        const strVal = String(val ?? '').toLowerCase()
        const condVal = condition.value.toLowerCase()

        switch (condition.operator) {
          case 'contains':
            return strVal.includes(condVal)
          case 'equals':
            return strVal === condVal
          case 'gt':
            return Number(val) > Number(condition.value)
          case 'lt':
            return Number(val) < Number(condition.value)
          case 'gte':
            return Number(val) >= Number(condition.value)
          case 'lte':
            return Number(val) <= Number(condition.value)
          case 'isEmpty':
            return !val || strVal === ''
          case 'isNotEmpty':
            return !!val && strVal !== ''
          default:
            return true
        }
      })
    })
  }, [rows, filterConfig])

  return {
    filterConfig,
    filteredRows,
    addCondition,
    removeCondition,
    clearConditions,
  }
}
