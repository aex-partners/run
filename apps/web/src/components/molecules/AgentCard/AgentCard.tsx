import React, { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Avatar } from '../../atoms/Avatar/Avatar'
import { Badge } from '../../atoms/Badge/Badge'

export interface AgentCardProps {
  id: string
  name: string
  description?: string
  avatar?: string
  skillCount?: number
  toolCount?: number
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

const ghostBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 6,
  background: 'none',
  border: '1px solid var(--border)',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  padding: 0,
  flexShrink: 0,
}

export function AgentCard({ id, name, description, avatar: _avatar, skillCount = 0, toolCount = 0, onEdit, onDelete }: AgentCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <Avatar name={name} size="md" />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
        </div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {description}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {skillCount > 0 && <Badge variant="info" size="sm">{skillCount} skills</Badge>}
        {toolCount > 0 && <Badge variant="neutral" size="sm">{toolCount} tools</Badge>}
      </div>

      {hovered && (onEdit || onDelete) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {onEdit && (
            <button style={ghostBtn} onClick={() => onEdit(id)} aria-label={`Edit ${name}`}>
              <Pencil size={13} />
            </button>
          )}
          {onDelete && (
            <button style={{ ...ghostBtn, borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => onDelete(id)} aria-label={`Delete ${name}`}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default AgentCard
