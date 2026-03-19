import React from 'react'

export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical'
}

export function Separator({ orientation = 'horizontal' }: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      style={
        orientation === 'horizontal'
          ? { width: '100%', height: 1, background: 'var(--border)', flexShrink: 0 }
          : { height: '100%', width: 1, background: 'var(--border)', flexShrink: 0 }
      }
    />
  )
}

export default Separator
