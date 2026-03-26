import { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { PRIORITY_COLORS } from '../constants'
import type { CellProps } from '../types'

export function PriorityCell({ column, value, onDirectCommit }: CellProps) {
  const [open, setOpen] = useState(false)

  const options = column.options ?? Object.keys(PRIORITY_COLORS).map(key => ({
    value: key,
    label: key,
    color: PRIORITY_COLORS[key],
  }))

  const dotColor = PRIORITY_COLORS[String(value)]
    ?? options.find(o => o.value === String(value))?.color
    ?? '#6b7280'

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            fontFamily: 'inherit',
            fontSize: 13,
            color: 'var(--text)',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
          {String(value) || 'Select...'}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            zIndex: 100,
            minWidth: 140,
            padding: '4px 0',
          }}
        >
          {options.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>No options configured</div>
          )}
          {options.map(opt => (
            <DropdownMenu.Item
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                fontSize: 13,
                cursor: 'pointer',
                outline: 'none',
                borderRadius: 4,
                color: 'var(--text)',
              }}
              onSelect={() => {
                onDirectCommit?.(opt.value)
              }}
            >
              <div style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: opt.color ?? '#6b7280',
                flexShrink: 0,
              }} />
              {opt.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
