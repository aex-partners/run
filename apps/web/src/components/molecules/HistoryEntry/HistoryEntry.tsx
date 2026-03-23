import React from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, ChevronRight, RefreshCw } from 'lucide-react'

export interface HistoryEntryProps {
  timestamp: string
  status: 'success' | 'failed'
  duration: string
  message: string
  details?: string
  onExpand?: () => void
  onRetry?: () => void
}

export function HistoryEntry({ timestamp, status, duration, message, details, onExpand, onRetry }: HistoryEntryProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = React.useState(false)
  const detailsId = React.useId()

  function handleExpandClick() {
    setExpanded((prev) => !prev)
    if (onExpand) onExpand()
  }

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '10px 16px',
        }}
      >
        <div
          aria-label={status === 'success' ? 'Success' : 'Failed'}
          style={{
            color: status === 'success' ? 'var(--success)' : 'var(--danger)',
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          {status === 'success' ? <CheckCircle2 size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>{message}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timestamp} · {duration}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {status === 'failed' && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              title={t('retry')}
              aria-label={t('retry')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '2px 6px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 11,
              }}
            >
              <RefreshCw size={11} />
              Retry
            </button>
          )}
          {onExpand && (
            <button
              type="button"
              onClick={handleExpandClick}
              title={expanded ? 'Collapse' : 'Expand'}
              aria-expanded={expanded}
              aria-controls={detailsId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'var(--text-muted)',
                transition: 'transform 0.15s ease',
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
      {expanded && details && (
        <div
          id={detailsId}
          style={{
            padding: '8px 16px 10px 40px',
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            background: 'var(--surface-2)',
          }}
        >
          {details}
        </div>
      )}
    </div>
  )
}

export default HistoryEntry
