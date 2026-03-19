import React, { useCallback, useEffect } from 'react'
import { Button } from '../../atoms/Button/Button'

/** @deprecated Use Confirmation component instead */
export interface ActionCardProps {
  question: string
  description?: string
  onConfirm?: () => void
  onDeny?: () => void
  confirmLabel?: string
  denyLabel?: string
  loading?: boolean
  active?: boolean
}

/** @deprecated Use Confirmation component instead */
export function ActionCard({
  question,
  description,
  onConfirm,
  onDeny,
  confirmLabel = 'Confirm',
  denyLabel = 'Cancel',
  loading = false,
  active = true,
}: ActionCardProps) {
  const stableConfirm = useCallback(() => {
    if (onConfirm) onConfirm()
  }, [onConfirm])

  const stableDeny = useCallback(() => {
    if (onDeny) onDeny()
  }, [onDeny])

  useEffect(() => {
    if (!active) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !loading && onConfirm) {
        stableConfirm()
      } else if (e.key === 'Escape' && onDeny) {
        stableDeny()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, loading, onConfirm, onDeny, stableConfirm, stableDeny])

  return (
    <div
      role="region"
      aria-label="Action required"
      style={{
        padding: '12px 14px',
        background: 'var(--surface-2)',
        borderRadius: 8,
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--accent)',
        maxWidth: 420,
      }}
    >
      <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: description ? 6 : 10, lineHeight: 1.5, fontWeight: 500 }}>
        {question}
      </p>
      {description && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
          {description}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant="primary"
          size="sm"
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
        <Button variant="secondary" size="sm" onClick={onDeny} disabled={loading}>
          {denyLabel}
        </Button>
      </div>
      {active && onConfirm && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          (Enter to confirm, Esc to cancel)
        </div>
      )}
    </div>
  )
}

export default ActionCard
