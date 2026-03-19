import React, { useState } from 'react'
import { Sparkles, Pencil, Trash2, ShieldCheck } from 'lucide-react'
import { Badge } from '../../atoms/Badge/Badge'

export interface SkillCardProps {
  id: string
  name: string
  description?: string
  toolCount?: number
  hasGuardrails?: boolean
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

export function SkillCard({ id, name, description, toolCount = 0, hasGuardrails = false, onEdit, onDelete }: SkillCardProps) {
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
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: '#eef2ff',
          border: '1px solid #c7d2fe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6366f1',
          flexShrink: 0,
        }}
      >
        <Sparkles size={16} />
      </div>

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
        {toolCount > 0 && <Badge variant="neutral" size="sm">{toolCount} tools</Badge>}
        {hasGuardrails && (
          <Badge variant="success" size="sm">
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <ShieldCheck size={10} /> Guardrails
            </span>
          </Badge>
        )}
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

export default SkillCard
