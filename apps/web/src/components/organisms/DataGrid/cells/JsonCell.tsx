import { useState, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'
import type { CellProps } from '../types'

export function JsonCell({ value, isEditing, editValue, onEditChange, onCommit, onCancel }: CellProps) {
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const displayValue = String(value)

  useEffect(() => {
    if (isEditing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync popover state with editing
      setOpen(true)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDirty(false)
    }
  }, [isEditing])

  const truncated = displayValue.length > 60 ? displayValue.slice(0, 60) + '...' : displayValue

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen && dirty) onCommit()
        else if (!nextOpen) onCancel()
      }}
    >
      <Popover.Trigger asChild>
        <span style={{
          fontSize: 12,
          fontFamily: 'monospace',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
          display: 'block',
        }}>
          {truncated || '{}'}
        </span>
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
            padding: 8,
            width: 320,
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onCancel()
              setOpen(false)
            }
          }}
        >
          <textarea
            autoFocus
            rows={6}
            value={editValue}
            onChange={(e) => { onEditChange(e.target.value); setDirty(true) }}
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '6px 8px',
              fontSize: 12,
              fontFamily: 'monospace',
              color: 'var(--text)',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
