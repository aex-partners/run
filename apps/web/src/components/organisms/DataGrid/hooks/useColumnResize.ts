import { useState, useCallback, useEffect, useRef } from 'react'
import { MIN_COLUMN_WIDTH } from '../constants'

export function useColumnResize(initialWidths: Record<string, number>) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(initialWidths)
  const resizingRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null)

  const getWidth = (colId: string, defaultWidth: number): number => {
    return columnWidths[colId] ?? defaultWidth
  }

  const startResize = useCallback((colId: string, startX: number, currentWidth: number) => {
    resizingRef.current = { colId, startX, startWidth: currentWidth }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const { colId, startX, startWidth } = resizingRef.current
      const delta = e.clientX - startX
      const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + delta)
      setColumnWidths(prev => ({ ...prev, [colId]: newWidth }))
    }

    const handleMouseUp = () => {
      if (!resizingRef.current) return
      resizingRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const isResizing = useCallback(() => resizingRef.current !== null, [])

  return {
    columnWidths,
    getWidth,
    startResize,
    isResizing,
  }
}
