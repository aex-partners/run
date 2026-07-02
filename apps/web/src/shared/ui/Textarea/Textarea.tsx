import React from 'react'

export interface TextareaProps {
  label?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  monospace?: boolean
  rows?: number
  'aria-label'?: string
}

export function Textarea({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  error,
  monospace = false,
  rows = 4,
  'aria-label': ariaLabel,
}: TextareaProps) {
  const [focused, setFocused] = React.useState(false)
  const uid = React.useId()
  const errorId = `textarea-error-${uid}`
  const labelId = `textarea-label-${uid}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label
          id={labelId}
          htmlFor={uid}
          style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}
        >
          {label}
        </label>
      )}
      <textarea
        id={uid}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        aria-label={ariaLabel}
        aria-labelledby={label ? labelId : undefined}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onFocus={() => setFocused(true)}
        onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 10px',
          background: 'var(--surface)',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
          borderRadius: 6,
          color: 'var(--text)',
          fontSize: 13,
          fontFamily: monospace ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit',
          lineHeight: 1.5,
          resize: 'vertical',
          outline: focused ? '2px solid var(--accent)' : 'none',
          outlineOffset: focused ? '-1px' : undefined,
          opacity: disabled ? 0.5 : 1,
        }}
      />
      {error && (
        <p id={errorId} style={{ margin: 0, fontSize: 11, color: 'var(--danger)' }}>{error}</p>
      )}
    </div>
  )
}

export default Textarea
