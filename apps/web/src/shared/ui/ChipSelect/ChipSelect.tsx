import React from 'react'

export interface ChipOption {
  value: string
  label: string
  icon?: React.ReactNode
}

export interface ChipSelectProps {
  options: ChipOption[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  multiple?: boolean
  label?: string
  error?: string
}

export function ChipSelect({
  options,
  value,
  onChange,
  multiple = false,
  label,
  error,
}: ChipSelectProps) {
  const isSelected = (optionValue: string) => {
    if (Array.isArray(value)) {
      return value.includes(optionValue)
    }
    return value === optionValue
  }

  const handleClick = (optionValue: string) => {
    if (multiple) {
      const current = Array.isArray(value) ? value : value ? [value] : []
      if (current.includes(optionValue)) {
        onChange(current.filter((v) => v !== optionValue))
      } else {
        onChange([...current, optionValue])
      }
    } else {
      onChange(optionValue)
    }
  }

  return (
    <div>
      {label && (
        <div
          id={`chipselect-label-${label}`}
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text)',
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      )}
      <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {options.map((option) => {
          const selected = isSelected(option.value)

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleClick(option.value)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                borderRadius: 20,
                cursor: 'pointer',
                transition: 'all 0.15s',
                border: selected
                  ? '2px solid var(--accent)'
                  : '1px solid var(--border)',
                background: selected ? 'var(--accent-light)' : '#fff',
                color: selected ? 'var(--accent)' : 'var(--text)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = selected ? 'var(--accent-light)' : 'var(--surface-2)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = selected ? 'var(--accent-light)' : '#fff'
              }}
            >
              {option.icon && option.icon}
              {option.label}
            </button>
          )
        })}
      </div>
      {error && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--danger)',
            marginTop: 6,
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}

export default ChipSelect
