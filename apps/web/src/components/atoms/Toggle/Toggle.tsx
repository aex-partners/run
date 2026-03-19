import React from 'react'

export interface ToggleProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  'aria-label'?: string
}

const sizes = {
  sm: { track: { width: 28, height: 16 }, thumb: 10, offset: 3, translate: 12 },
  md: { track: { width: 36, height: 20 }, thumb: 14, offset: 3, translate: 16 },
}

export function Toggle({
  checked = false,
  onChange,
  disabled = false,
  size = 'md',
  'aria-label': ariaLabel,
}: ToggleProps) {
  const s = sizes[size]

  return (
    <button
      role="switch"
      type="button"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      style={{
        position: 'relative',
        width: s.track.width,
        height: s.track.height,
        borderRadius: s.track.height,
        background: checked ? 'var(--accent)' : 'var(--border)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        padding: 0,
        transition: 'background 0.15s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: s.offset,
          left: checked ? s.translate : s.offset,
          width: s.thumb,
          height: s.thumb,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  )
}

export default Toggle
