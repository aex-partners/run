import * as Popover from '@radix-ui/react-popover'
import { Group } from 'lucide-react'
import type { GridColumn } from '../types'

interface GroupByPickerProps {
  columns: GridColumn[]
  activeGroupBy: string | null
  onGroupByChange: (colId: string | null) => void
}

export function GroupByPicker({ columns, activeGroupBy, onGroupByChange }: GroupByPickerProps) {
  const groupableColumns = columns.filter(c =>
    c.type === 'status' || c.type === 'select' || c.type === 'badge' || c.type === 'priority' || c.type === 'text'
  )

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            background: activeGroupBy ? 'var(--accent-light)' : 'var(--surface-2)',
            border: `1px solid ${activeGroupBy ? 'var(--accent-border)' : 'var(--border)'}`,
            borderRadius: 6,
            color: activeGroupBy ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Group size={13} />
          Group
          {activeGroupBy && (
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'inline-block',
              marginLeft: 2,
            }} />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            zIndex: 100,
            minWidth: 160,
            padding: '4px 0',
          }}
        >
          <button
            onClick={() => onGroupByChange(null)}
            style={{
              display: 'block',
              width: '100%',
              padding: '7px 14px',
              background: !activeGroupBy ? 'var(--accent-light)' : 'none',
              border: 'none',
              fontSize: 13,
              color: !activeGroupBy ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            No grouping
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          {groupableColumns.map(col => (
            <button
              key={col.id}
              onClick={() => onGroupByChange(col.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '7px 14px',
                background: activeGroupBy === col.id ? 'var(--accent-light)' : 'none',
                border: 'none',
                fontSize: 13,
                color: activeGroupBy === col.id ? 'var(--accent)' : 'var(--text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                fontWeight: activeGroupBy === col.id ? 500 : 400,
              }}
            >
              {col.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
