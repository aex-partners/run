import { useState, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Avatar } from '../../../atoms/Avatar/Avatar'
import type { CellProps } from '../types'

export function PersonCell({
  value,
  isEditing,
  editValue,
  onEditChange,
  onCommit,
  onCancel,
  onDirectCommit,
  workspaceUsers,
}: CellProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const names = String(value).split(',').map(n => n.trim()).filter(Boolean)

  useEffect(() => {
    if (isEditing) setOpen(true)
  }, [isEditing])

  const hasUsers = workspaceUsers && workspaceUsers.length > 0

  if (!hasUsers) {
    // Fallback: plain text input
    if (isEditing) {
      return (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit()
            if (e.key === 'Escape') onCancel()
          }}
          style={{
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid var(--accent)',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 13,
            color: 'var(--text)',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
      )
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {names.map((name, i) => (
          <div key={name} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: names.length - i, position: 'relative' }}>
            <Avatar name={name} size="sm" />
          </div>
        ))}
      </div>
    )
  }

  const filtered = workspaceUsers!.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setSearch('')
      }}
    >
      <Popover.Trigger asChild>
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          {names.length > 0 ? (
            names.map((name, i) => (
              <div key={name} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: names.length - i, position: 'relative' }}>
                <Avatar name={name} size="sm" />
              </div>
            ))
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Assign...</span>
          )}
        </div>
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
            width: 220,
            padding: '8px 0',
          }}
        >
          <div style={{ padding: '0 8px 6px' }}>
            <input
              autoFocus
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 13,
                color: 'var(--text)',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>No users found</div>
            )}
            {filtered.map((user) => (
              <div
                key={user.id}
                onClick={() => {
                  onDirectCommit?.(user.name)
                  setOpen(false)
                  setSearch('')
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: 'var(--text)',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.background = 'var(--border)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
              >
                <Avatar name={user.name} size="sm" />
                {user.name}
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
