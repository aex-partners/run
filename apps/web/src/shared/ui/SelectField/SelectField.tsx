import React from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectFieldOption {
  value: string
  label: string
}

export interface SelectFieldProps {
  label?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: SelectFieldOption[]
  placeholder?: string
  disabled?: boolean
  error?: string
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  error,
}: SelectFieldProps) {
  const [focused, setFocused] = React.useState(false)
  const uid = React.useId()
  const errorId = `select-error-${uid}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label
          htmlFor={uid}
          style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          background: 'var(--surface)',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
          borderRadius: 6,
          opacity: disabled ? 0.5 : 1,
          outline: focused ? '2px solid var(--accent)' : 'none',
          outlineOffset: focused ? '-1px' : undefined,
        }}
      >
        <select
          id={uid}
          value={value ?? ''}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: '6px 30px 6px 10px',
            background: 'none',
            border: 'none',
            outline: 'none',
            color: value ? 'var(--text)' : 'var(--text-muted)',
            fontSize: 14,
            fontFamily: 'inherit',
            cursor: disabled ? 'not-allowed' : 'pointer',
            appearance: 'none',
          }}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span
          style={{
            position: 'absolute',
            right: 8,
            pointerEvents: 'none',
            color: 'var(--text-muted)',
            display: 'flex',
          }}
        >
          <ChevronDown size={14} />
        </span>
      </div>
      {error && (
        <p id={errorId} style={{ margin: 0, fontSize: 12, color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

export default SelectField
