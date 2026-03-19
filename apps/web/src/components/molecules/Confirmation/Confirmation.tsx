import React, { useCallback, useEffect } from 'react'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { Button } from '../../atoms/Button/Button'
import { Badge } from '../../atoms/Badge/Badge'

export interface ConfirmationProps {
  title: string
  description?: string
  state: 'requested' | 'accepted' | 'rejected' | 'pending'
  onApprove?: () => void
  onReject?: () => void
  approveLabel?: string
  rejectLabel?: string
}

const borderColors: Record<ConfirmationProps['state'], string> = {
  requested: 'var(--accent)',
  accepted: 'var(--success)',
  rejected: 'var(--danger)',
  pending: 'var(--border)',
}

export function Confirmation({
  title,
  description,
  state,
  onApprove,
  onReject,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
}: ConfirmationProps) {
  const stableApprove = useCallback(() => {
    if (onApprove) onApprove()
  }, [onApprove])

  const stableReject = useCallback(() => {
    if (onReject) onReject()
  }, [onReject])

  useEffect(() => {
    if (state !== 'requested') return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && onApprove) {
        stableApprove()
      } else if (e.key === 'Escape' && onReject) {
        stableReject()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state, onApprove, onReject, stableApprove, stableReject])

  return (
    <div
      role="region"
      aria-label="Confirmation"
      style={{
        padding: '12px 14px',
        background: 'var(--surface-2)',
        borderRadius: 8,
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${borderColors[state]}`,
        maxWidth: 420,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: description || state === 'requested' ? 6 : 0 }}>
        {state === 'accepted' && <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />}
        {state === 'rejected' && <XCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />}
        {state === 'pending' && <Clock size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />}

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.5 }}>
              {title}
            </span>
            {state === 'accepted' && <Badge variant="success" size="sm">Approved</Badge>}
            {state === 'rejected' && <Badge variant="danger" size="sm">Rejected</Badge>}
            {state === 'pending' && <Badge variant="neutral" size="sm">Awaiting...</Badge>}
          </div>
        </div>
      </div>

      {description && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: state === 'requested' ? 10 : 0, lineHeight: 1.5 }}>
          {description}
        </p>
      )}

      {state === 'requested' && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" size="sm" onClick={onApprove}>
              {approveLabel}
            </Button>
            <Button variant="secondary" size="sm" onClick={onReject}>
              {rejectLabel}
            </Button>
          </div>
          {onApprove && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              (Enter to approve, Esc to reject)
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Confirmation
