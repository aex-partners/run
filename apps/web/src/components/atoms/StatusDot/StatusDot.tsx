import React from 'react'

export interface StatusDotProps {
  variant: 'active' | 'paused' | 'error' | 'pending'
  label?: string
}

const variantColors: Record<NonNullable<StatusDotProps['variant']>, string> = {
  active: 'var(--success)',
  paused: 'var(--text-muted)',
  error: 'var(--danger)',
  pending: 'var(--warning)',
}

export function StatusDot({ variant, label }: StatusDotProps) {
  return (
    <span
      role="status"
      aria-label={label ?? variant}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: variantColors[variant],
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
      {label && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      )}
    </span>
  )
}

export default StatusDot
