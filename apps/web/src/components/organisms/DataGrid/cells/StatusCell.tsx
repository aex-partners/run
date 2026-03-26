import { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { CellProps } from '../types'

export function StatusCell({ column, value, onDirectCommit }: CellProps) {
  const [open, setOpen] = useState(false)

  const options = column.options ?? (
    column.statusColors
      ? Object.keys(column.statusColors).map(key => ({
          value: key,
          label: key,
          color: column.statusColors![key],
        }))
      : []
  )

  const currentColor = column.statusColors?.[String(value)]
    ?? options.find(o => o.value === String(value))?.color
    ?? '#6b7280'

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          style={{
            background: currentColor,
            color: '#fff',
            borderRadius: 20,
            padding: '3px 10px',
            fontSize: 12,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
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
