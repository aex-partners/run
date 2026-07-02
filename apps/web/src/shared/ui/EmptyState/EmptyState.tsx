import React from 'react'

export interface EmptyStateProps {
  /** Illustrative icon (sits in a rounded tinted square). */
  icon?: React.ReactNode
  title: string
  description?: string
  /** Optional primary action (e.g. a Button) to give the empty screen a next step. */
  action?: React.ReactNode
}

/**
 * Standard empty-state block: icon + title + description + optional CTA. Replaces
 * the bare one-line "No X found" placeholders so every empty screen reads the same
 * (Workflows/Mail already used this shape; Tasks/Files/Knowledge were bare).
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      {icon && (
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface-2)',
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      {description && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340, lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}

export default EmptyState
