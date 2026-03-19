import React from 'react'
import { Settings, Plug } from 'lucide-react'
import { Badge } from '../../atoms/Badge/Badge'
import { Toggle } from '../../atoms/Toggle/Toggle'

export type IntegrationType = 'rest' | 'oauth2' | 'webhook'

export interface IntegrationCardProps {
  id: string
  name: string
  description?: string
  type: IntegrationType
  enabled?: boolean
  onToggle?: (id: string, enabled: boolean) => void
  onConfigure?: (id: string) => void
}

const typeVariant: Record<IntegrationType, { label: string; variant: 'orange' | 'info' | 'success' }> = {
  rest: { label: 'REST', variant: 'orange' },
  oauth2: { label: 'OAuth2', variant: 'info' },
  webhook: { label: 'Webhook', variant: 'success' },
}

export function IntegrationCard({ id, name, description, type, enabled = false, onToggle, onConfigure }: IntegrationCardProps) {
  const tv = typeVariant[type]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: enabled ? 'var(--accent)' : 'var(--text-muted)',
        }}
      >
        <Plug size={18} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
          <Badge variant={tv.variant} size="sm">{tv.label}</Badge>
          <Badge variant={enabled ? 'success' : 'neutral'} size="sm" dot>{enabled ? 'Enabled' : 'Disabled'}</Badge>
        </div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{description}</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <Toggle
          checked={enabled}
          onChange={(checked) => onToggle?.(id, checked)}
          size="sm"
          aria-label={`Toggle ${name}`}
        />
        {onConfigure && (
          <button
            onClick={() => onConfigure(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 12,
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
            aria-label={`Configure ${name}`}
          >
            <Settings size={12} />
            Configure
          </button>
        )}
      </div>
    </div>
  )
}

export default IntegrationCard
