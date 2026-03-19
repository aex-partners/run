import { ChevronDown, ChevronRight } from 'lucide-react'
import type { RowGroup } from '../types'
import { hexToRgba } from '../constants'

interface GroupHeaderProps {
  group: RowGroup
  rowCount: number
  isCollapsed: boolean
  onToggle: (groupId: string) => void
}

export function GroupHeader({ group, rowCount, isCollapsed, onToggle }: GroupHeaderProps) {
  return (
    <div
      role="row"
      data-testid={`group-header-${group.id}`}
      onClick={() => onToggle(group.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        borderLeft: `3px solid ${group.color}`,
        background: hexToRgba(group.color, 0.08),
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {isCollapsed
        ? <ChevronRight size={14} style={{ color: group.color }} />
        : <ChevronDown size={14} style={{ color: group.color }} />
      }
      <span style={{ fontWeight: 600, fontSize: 13, color: group.color }}>{group.label}</span>
      <span style={{
        fontSize: 11,
        color: 'var(--text-muted)',
        background: 'var(--surface-2)',
        padding: '1px 8px',
        borderRadius: 10,
        border: '1px solid var(--border)',
      }}>
        {rowCount}
      </span>
    </div>
  )
}
