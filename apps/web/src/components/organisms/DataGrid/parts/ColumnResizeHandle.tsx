import React from 'react'

interface ColumnResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void
}

export function ColumnResizeHandle({ onMouseDown }: ColumnResizeHandleProps) {
  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onMouseDown(e)
      }}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 4,
        cursor: 'col-resize',
        background: 'transparent',
        zIndex: 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--accent)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    />
  )
}
