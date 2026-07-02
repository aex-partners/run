import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../shared/ui/Button/Button'

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
  confirmLabel,
  denyLabel,
  loading = false,
  active = true,
}: ActionCardProps) {
  const { t } = useTranslation()
  const onConfirmRef = useRef(onConfirm)
  const onDenyRef = useRef(onDeny)
  const loadingRef = useRef(loading)

  useEffect(() => {
    onConfirmRef.current = onConfirm
    onDenyRef.current = onDeny
    loadingRef.current = loading
  }, [onConfirm, onDeny, loading])

  useEffect(() => {
    if (!active) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !loadingRef.current && onConfirmRef.current) {
        onConfirmRef.current()
      } else if (e.key === 'Escape' && onDenyRef.current) {
        onDenyRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active])

  return (
    <div
      role="region"
      aria-label={t('actionCard.ariaLabel')}
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
          {confirmLabel ?? t('confirm')}
        </Button>
        <Button variant="secondary" size="sm" onClick={onDeny} disabled={loading}>
          {denyLabel ?? t('cancel')}
        </Button>
      </div>
      {active && onConfirm && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          {t('actionCard.keyboardHint')}
        </div>
      )}
    </div>
  )
}

export default ActionCard
