import React from 'react'

export interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  online?: boolean
  onClick?: () => void
}

const sizeMap: Record<NonNullable<AvatarProps['size']>, number> = {
  sm: 24,
  md: 32,
  lg: 40,
}

const fontSizeMap: Record<NonNullable<AvatarProps['size']>, number> = {
  sm: 9,
  md: 12,
  lg: 14,
}

const dotSizeMap: Record<NonNullable<AvatarProps['size']>, number> = {
  sm: 7,
  md: 9,
  lg: 11,
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b',
  '#22c55e', '#ef4444', '#ec4899', '#14b8a6',
]

function getColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function Avatar({ name, size = 'md', online = false, onClick }: AvatarProps) {
  const px = sizeMap[size]
  const color = getColor(name)
  const [hovered, setHovered] = React.useState(false)

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <div
        onClick={onClick}
        onMouseEnter={onClick ? () => setHovered(true) : undefined}
        onMouseLeave={onClick ? () => setHovered(false) : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
        role={onClick ? 'button' : undefined}
        aria-label={onClick ? 'User avatar' : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{
          width: px,
          height: px,
          borderRadius: '50%',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: fontSizeMap[size],
          fontWeight: 600,
          color: '#fff',
          flexShrink: 0,
          cursor: onClick ? 'pointer' : undefined,
          boxShadow: onClick && hovered ? '0 0 0 2px var(--accent)' : undefined,
          transition: 'box-shadow 0.15s ease',
        }}
      >
        {getInitials(name)}
      </div>
      {online && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: dotSizeMap[size],
            height: dotSizeMap[size],
            boxSizing: 'border-box',
            borderRadius: '50%',
            background: 'var(--success)',
            border: '2px solid var(--surface)',
          }}
        />
      )}
    </div>
  )
}

export default Avatar
