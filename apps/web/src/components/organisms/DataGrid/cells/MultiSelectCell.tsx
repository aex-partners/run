import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import type { CellProps } from '../types'

export function MultiSelectCell({ column, value, onDirectCommit }: CellProps) {
  const [open, setOpen] = useState(false)
  const options = column.options ?? []
  const selectedValues = String(value).split(',').map(v => v.trim()).filter(Boolean)

  const selectedOptions = selectedValues
    .map(v => options.find(o => o.value === v))
    .filter(Boolean)

  function toggle(optValue: string) {
    const current = new Set(selectedValues)
    if (current.has(optValue)) {
      current.delete(optValue)
    } else {
      current.add(optValue)
    }
    onDirectCommit?.(Array.from(current).join(', '))
  }

  const display = selectedOptions.length === 0
    ? <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>-</span>
    : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {selectedOptions.map(opt => (
          <span
            key={opt!.value}
            style={{
              background: opt!.color ? `${opt!.color}20` : 'var(--surface-2)',
              color: opt!.color ?? 'var(--text)',
              border: `1px solid ${opt!.color ?? 'var(--border)'}`,
              borderRadius: 12,
              padding: '1px 8px',
              fontSize: 11,
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {opt!.label}
          </span>
        ))}
      </div>
    )

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 0',
            fontFamily: 'inherit',
            textAlign: 'left',
            width: '100%',
          }}
        >
          {display}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            zIndex: 100,
            minWidth: 180,
            padding: '6px 0',
          }}
        >
          {options.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>No options configured</div>
          )}
          {options.map(opt => {
            const checked = selectedValues.includes(opt.value)
            return (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: 'var(--text)',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                {opt.color && (
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: opt.color,
                    flexShrink: 0,
                  }} />
                )}
                {opt.label}
              </label>
            )
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
