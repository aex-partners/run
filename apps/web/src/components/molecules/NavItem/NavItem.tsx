import React from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'

export interface NavItemProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
  badge?: number
}

export function NavItem({ icon, label, active = false, onClick, badge }: NavItemProps) {
  const buttonLabel = badge != null && badge > 0 ? `${label}, ${badge} notifications` : label

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          onClick={onClick}
          aria-label={buttonLabel}
          aria-current={active ? 'page' : undefined}
          aria-pressed={active}
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            border: 'none',
            background: active ? 'var(--accent-light)' : 'transparent',
            color: active ? 'var(--accent)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s',
            position: 'relative',
          }}
        >
          {icon}
          {active && (
            <div
              style={{
                position: 'absolute',
                left: -8,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 3,
                height: 20,
                borderRadius: '0 3px 3px 0',
                background: 'var(--accent)',
              }}
            />
          )}
          {badge != null && badge > 0 && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                minWidth: 14,
                height: 14,
                borderRadius: 7,
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 8,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
              }}
            >
              {badge}
            </div>
          )}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text)',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          {label}
          <Tooltip.Arrow style={{ fill: 'var(--surface-2)' }} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export default NavItem
