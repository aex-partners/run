import { useState, useCallback } from 'react'
import type { GridColumn } from '../types'

interface InlineEditState {
  isActive: boolean
  values: Record<string, string>
}

export function useInlineEdit(columns: GridColumn[], idCol: string) {
  const [state, setState] = useState<InlineEditState>({ isActive: false, values: {} })

  const startNewRow = useCallback(() => {
    setState({ isActive: true, values: {} })
  }, [])

  const updateValue = useCallback((colId: string, value: string) => {
    setState(prev => ({
      ...prev,
      values: { ...prev.values, [colId]: value },
    }))
  }, [])

  const commitRow = useCallback(() => {
    const hasContent = Object.values(state.values).some(v => v.trim() !== '')
    if (!hasContent) {
      setState({ isActive: false, values: {} })
      return null
    }
    const rowData = { ...state.values }
    setState({ isActive: true, values: {} }) // reset for next row
    return rowData
  }, [state.values])

  const cancelRow = useCallback(() => {
    setState({ isActive: false, values: {} })
  }, [])

  const getEditableColumns = useCallback(() => {
    return columns.filter(
      col => col.id !== idCol && col.type !== 'badge' && col.type !== 'priority'
    )
  }, [columns, idCol])

  return {
    isActive: state.isActive,
    values: state.values,
    startNewRow,
    updateValue,
    commitRow,
    cancelRow,
    getEditableColumns,
  }
}
