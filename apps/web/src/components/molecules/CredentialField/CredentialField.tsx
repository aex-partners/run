import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export interface CredentialFieldProps {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  disabled?: boolean
  label?: string
}

export function CredentialField({
  value,
  onChange,
  placeholder = 'Enter secret...',
  disabled = false,
  label,
}: CredentialFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</label>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '6px 10px',
          opacity: disabled ? 0.5 : 1,
          outline: focused ? '2px solid var(--accent)' : 'none',
          outlineOffset: focused ? '-1px' : undefined,
        }}
      >
        <input
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontSize: 13,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        />
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          disabled={disabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
          aria-label={revealed ? 'Hide value' : 'Reveal value'}
        >
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}

export default CredentialField
