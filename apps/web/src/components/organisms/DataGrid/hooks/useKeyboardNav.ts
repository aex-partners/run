import { useState, useCallback, useEffect } from 'react'
import type { GridColumn } from '../types'

interface ActiveCell {
  rowIndex: number
  colIndex: number
}

export function useKeyboardNav(
  visibleRowCount: number,
  visibleColumns: GridColumn[],
  onStartEditing: (rowIndex: number, colIndex: number) => void,
) {
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)

  const moveUp = useCallback(() => {
    setActiveCell(prev => {
      if (!prev) return { rowIndex: 0, colIndex: 0 }
      return { ...prev, rowIndex: Math.max(0, prev.rowIndex - 1) }
    })
  }, [])

  const moveDown = useCallback(() => {
    setActiveCell(prev => {
      if (!prev) return { rowIndex: 0, colIndex: 0 }
      return { ...prev, rowIndex: Math.min(visibleRowCount - 1, prev.rowIndex + 1) }
    })
  }, [visibleRowCount])

  const moveLeft = useCallback(() => {
    setActiveCell(prev => {
      if (!prev) return { rowIndex: 0, colIndex: 0 }
      return { ...prev, colIndex: Math.max(0, prev.colIndex - 1) }
    })
  }, [])

  const moveRight = useCallback(() => {
    setActiveCell(prev => {
      if (!prev) return { rowIndex: 0, colIndex: 0 }
      return { ...prev, colIndex: Math.min(visibleColumns.length - 1, prev.colIndex + 1) }
    })
  }, [visibleColumns.length])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!activeCell) return

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        moveUp()
        break
      case 'ArrowDown':
        e.preventDefault()
        moveDown()
        break
      case 'ArrowLeft':
        e.preventDefault()
        moveLeft()
        break
      case 'ArrowRight':
      case 'Tab':
        e.preventDefault()
        if (e.shiftKey) moveLeft()
        else moveRight()
        break
      case 'Enter':
        e.preventDefault()
        onStartEditing(activeCell.rowIndex, activeCell.colIndex)
        break
      case 'Escape':
        setActiveCell(null)
        break
    }
  }, [activeCell, moveUp, moveDown, moveLeft, moveRight, onStartEditing])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    activeCell,
    setActiveCell,
  }
}
