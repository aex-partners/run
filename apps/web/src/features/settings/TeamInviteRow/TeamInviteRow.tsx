import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

export interface TeamInviteRowProps {
  value: string
  placeholder?: string
  error?: string
  onChange?: (value: string) => void
  onRemove?: () => void
  onCommit?: () => void
  inputRef?: (el: HTMLInputElement | null) => void
}

export function TeamInviteRow({
  value,
  placeholder,
  error,
  onChange,
  onRemove,
  onCommit,
  inputRef,
}: TeamInviteRowProps) {
  const { t } = useTranslation()
  const [focused, setFocused] = useState(false)
  const resolvedPlaceholder = placeholder ?? t('teamInviteRow.emailPlaceholder')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          ref={inputRef}
          type="email"
          aria-label={t('teamInviteRow.inviteEmailLabel')}
          value={value}
          placeholder={resolvedPlaceholder}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onCommit?.() }
            if (e.key === 'Escape') { e.preventDefault(); onRemove?.() }
          }}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 14,
            fontFamily: 'inherit',
            border: `1px solid ${error ? 'var(--danger)' : focused ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 8,
            outline: 'none',
            background: 'var(--surface)',
            color: 'var(--text)',
            transition: 'border-color 0.15s',
          }}
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t('teamInviteRow.removeInvite')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              borderRadius: 4,
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {error && (
        <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>
      )}
    </div>
  )
}

export default TeamInviteRow
