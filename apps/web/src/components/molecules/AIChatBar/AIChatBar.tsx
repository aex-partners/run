import React from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Send } from 'lucide-react'

export interface AIChatBarProps {
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSend?: () => void
  disabled?: boolean
}

export function AIChatBar({
  placeholder = 'Ask the AI...',
  value = '',
  onChange,
  onSend,
  disabled = false,
}: AIChatBarProps) {
  const { t } = useTranslation()
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && onSend) {
      onSend()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--surface-2)',
        borderRadius: 10,
        padding: '8px 12px',
        border: '1px solid var(--accent-border)',
      }}
    >
      <Bot size={16} color="var(--accent)" style={{ flexShrink: 0 }} aria-hidden="true" />
      <input
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Ask AI"
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          outline: 'none',
          color: 'var(--text)',
          fontSize: 13,
          fontFamily: 'inherit',
        }}
      />
      <button
        onClick={onSend}
        disabled={disabled || !value}
        aria-label={t('promptInput.sendMessage')}
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: value && !disabled ? 'var(--accent)' : 'transparent',
          border: 'none',
          color: value && !disabled ? '#fff' : 'var(--text-muted)',
          cursor: value && !disabled ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
      >
        <Send size={13} />
      </button>
    </div>
  )
}

export default AIChatBar
