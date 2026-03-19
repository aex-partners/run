import React from 'react'
import * as LucideIcons from 'lucide-react'

export interface RoutineCardProps {
  name: string
  description: string
  icon: string
  selected?: boolean
  onClick?: () => void
}

export function RoutineCard({
  name,
  description,
  icon,
  selected = false,
  onClick,
}: RoutineCardProps) {
  const IconComponent = (LucideIcons as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>)[icon] || LucideIcons.Package

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: 14,
        background: selected ? '#f8f8f8' : 'var(--surface)',
        border: `1.5px solid ${selected ? 'var(--accent-border)' : 'var(--border)'}`,
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
        width: '100%',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: selected ? 'var(--accent-light)' : 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconComponent size={16} style={{ color: selected ? 'var(--accent)' : 'var(--text-muted)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
      </div>
    </button>
  )
}

export default RoutineCard
