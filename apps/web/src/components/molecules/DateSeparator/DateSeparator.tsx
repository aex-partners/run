import React from 'react'

export interface DateSeparatorProps {
  label: string
}

export function DateSeparator({ label }: DateSeparatorProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 0',
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          background: 'var(--surface-2)',
          borderRadius: 12,
          padding: '3px 12px',
          fontWeight: 500,
          userSelect: 'none',
        }}
      >
        {label}
      </span>
    </div>
  )
}

export default DateSeparator
