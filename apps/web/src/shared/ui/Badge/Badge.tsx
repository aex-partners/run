import React from 'react'

export interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange'
  size?: 'sm' | 'md'
  dot?: boolean
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, { bg: string; color: string; dotColor: string }> = {
  success: { bg: 'var(--success-light)', color: 'var(--success)', dotColor: 'var(--success)' },
  warning: { bg: 'var(--warning-light)', color: 'var(--warning)', dotColor: 'var(--warning)' },
  danger: { bg: 'var(--danger-light)', color: 'var(--danger)', dotColor: 'var(--danger)' },
  info: { bg: '#eff6ff', color: '#2563eb', dotColor: '#2563eb' },
  neutral: { bg: 'var(--surface-2)', color: 'var(--text-muted)', dotColor: 'var(--text-muted)' },
  orange: { bg: 'var(--accent-light)', color: 'var(--accent)', dotColor: 'var(--accent)' },
}

const sizeStyles: Record<NonNullable<BadgeProps['size']>, React.CSSProperties> = {
  sm: { padding: '1px 6px', fontSize: 10, borderRadius: 10 },
  md: { padding: '2px 8px', fontSize: 11, borderRadius: 12 },
}

export function Badge({ children, variant = 'neutral', size = 'md', dot = false }: BadgeProps) {
  const styles = variantStyles[variant]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontWeight: 500,
        background: styles.bg,
        color: styles.color,
        ...sizeStyles[size],
      }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: styles.dotColor,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  )
}

export default Badge
