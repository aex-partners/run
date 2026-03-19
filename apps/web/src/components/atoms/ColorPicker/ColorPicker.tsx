import React from 'react'

export interface ColorPickerProps {
  value?: string
  onChange?: (color: string) => void
  presets?: string[]
  label?: string
}

const DEFAULT_PRESETS = [
  '#EA580C', '#dc2626', '#d97706', '#16a34a',
  '#2563eb', '#7c3aed', '#db2777', '#0891b2',
  '#4f46e5', '#059669',
]

export function ColorPicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  label,
}: ColorPickerProps) {
  const uid = React.useId()

  const handleSwatchClick = (color: string) => {
    onChange?.(color)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
          {label}
        </label>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Select color ${color}`}
            aria-pressed={value === color}
            onClick={() => handleSwatchClick(color)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: color,
              border: 'none',
              cursor: 'pointer',
              outline: value === color ? `2px solid var(--accent)` : 'none',
              outlineOffset: 2,
              flexShrink: 0,
              transition: 'outline 0.15s',
            }}
          />
        ))}
        <label
          htmlFor={uid}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px dashed var(--border)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
          aria-label="Pick custom color"
        >
          <input
            id={uid}
            type="color"
            value={value || '#EA580C'}
            onChange={handleInputChange}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>+</span>
        </label>
      </div>
    </div>
  )
}

export default ColorPicker
