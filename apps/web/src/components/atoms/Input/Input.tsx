import React from 'react'
import { X } from 'lucide-react'

export interface InputProps {
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  onClear?: () => void
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  disabled?: boolean
  error?: string
  type?: string
}

export function Input({
  placeholder,
  value,
  onChange,
  onBlur,
  onClear,
  leftIcon,
  rightIcon,
  disabled = false,
  error,
  type = 'text',
}: InputProps) {
  const [focused, setFocused] = React.useState(false)
  const uid = React.useId()
  const errorId = `input-error-${uid}`
  const showClear = onClear && value && value.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--surface)',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
          borderRadius: 8,
          padding: '10px 14px',
          opacity: disabled ? 0.5 : 1,
          outline: focused ? '2px solid var(--accent)' : 'none',
          outlineOffset: focused ? '-1px' : undefined,
        }}
      >
        {leftIcon && (
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>{leftIcon}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        />
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
            aria-label="Clear input"
          >
            <X size={14} />
          </button>
        )}
        {!showClear && rightIcon && (
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>{rightIcon}</span>
        )}
      </div>
      {error && (
        <p id={errorId} style={{ margin: 0, fontSize: 12, color: 'var(--danger)' }}>{error}</p>
      )}
    </div>
  )
}

export default Input
