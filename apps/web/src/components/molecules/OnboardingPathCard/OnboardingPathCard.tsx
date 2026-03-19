import React from 'react'
import * as LucideIcons from 'lucide-react'

export interface OnboardingPathCardProps {
  title: string
  description: string
  icon: string
  selected?: boolean
  onClick?: () => void
}

export function OnboardingPathCard({
  title,
  description,
  icon,
  selected = false,
  onClick,
}: OnboardingPathCardProps) {
  const IconComponent = (LucideIcons as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>)[icon] || LucideIcons.Package

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: 28,
        background: selected ? 'var(--accent-light)' : 'var(--surface)',
        border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'center',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
        flex: 1,
        minWidth: 200,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: selected ? 'var(--accent)' : 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconComponent size={24} style={{ color: selected ? '#fff' : 'var(--text-muted)' }} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
    </button>
  )
}

export default OnboardingPathCard
