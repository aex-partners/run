import React, { useState } from 'react'
import { Pencil, Trash2, Play } from 'lucide-react'
import { Badge } from '../../atoms/Badge/Badge'

export type CustomToolType = 'http' | 'query' | 'code' | 'composite'

export interface CustomToolCardProps {
  id: string
  name: string
  description?: string
  type: CustomToolType
  integrationName?: string
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onTest?: (id: string) => void
}

const typeVariant: Record<CustomToolType, { label: string; variant: 'orange' | 'info' | 'success' | 'warning' }> = {
  http: { label: 'HTTP', variant: 'orange' },
  query: { label: 'Query', variant: 'info' },
  code: { label: 'Code', variant: 'success' },
  composite: { label: 'Composite', variant: 'warning' },
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

export function CustomToolCard({ id, name, description, type, integrationName, onEdit, onDelete, onTest }: CustomToolCardProps) {
  const [hovered, setHovered] = useState(false)
  const tv = typeVariant[type]

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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
          >
            {name}
          </span>
          <Badge variant={tv.variant} size="sm">{tv.label}</Badge>
          {integrationName && <Badge variant="neutral" size="sm">{integrationName}</Badge>}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {description}
          </div>
        )}
      </div>

      {hovered && (onTest || onEdit || onDelete) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {onTest && (
            <button style={{ ...ghostBtn, borderColor: 'var(--success)', color: 'var(--success)' }} onClick={() => onTest(id)} aria-label={`Test ${name}`}>
              <Play size={13} />
            </button>
          )}
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

export default CustomToolCard
