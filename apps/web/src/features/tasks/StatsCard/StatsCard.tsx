import React from 'react'
import { useTranslation } from 'react-i18next'
import { TrendingUp, TrendingDown } from 'lucide-react'

export interface StatsCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: { value: number; direction: 'up' | 'down' }
  /** Label shown next to the trend percentage. Defaults to the translated "vs last month". */
  trendLabel?: string
  onClick?: () => void
  tooltip?: string
  /** Semantic color for the icon (e.g. status hue). Defaults to brand accent. */
  iconColor?: string
}

export function StatsCard({ label, value, icon, trend, trendLabel, onClick, tooltip, iconColor }: StatsCardProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = React.useState(false)
  const resolvedTrendLabel = trendLabel ?? t('statsCard.trendLabel')

  return (
    <div
      title={tooltip}
      onClick={onClick}
      onMouseEnter={onClick ? () => setHovered(true) : undefined}
      onMouseLeave={onClick ? () => setHovered(false) : undefined}
      style={{
        padding: '16px',
        background: 'var(--surface)',
        border: `1px solid ${onClick && hovered ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: onClick ? 'pointer' : undefined,
        boxShadow: onClick && hovered ? '0 2px 8px rgba(0,0,0,0.10)' : undefined,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
        {icon && (
          <span style={{ color: iconColor ?? 'var(--accent)', display: 'flex' }}>{icon}</span>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
      {trend && (
        <div
          aria-label={t('statsCard.trendAriaLabel', {
            direction: trend.direction === 'up' ? t('statsCard.directionUp') : t('statsCard.directionDown'),
            value: trend.value,
          })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: trend.direction === 'up' ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {trend.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend.value}% {resolvedTrendLabel}
        </div>
      )}
    </div>
  )
}

export default StatsCard
