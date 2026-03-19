import React, { useState } from 'react'

export interface MailFolderItemProps {
  icon: React.ReactNode
  label: string
  count?: number
  active?: boolean
  onClick?: () => void
}

export function MailFolderItem({
  icon,
  label,
  count,
  active = false,
  onClick,
}: MailFolderItemProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={active ? 'page' : undefined}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: active ? 'var(--accent-light)' : hovered ? 'var(--surface-2)' : 'transparent',
        border: 'none',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ color: active ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--accent)' : 'var(--text)',
        flex: 1,
      }}>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: active ? 'var(--accent)' : 'var(--text-muted)',
          minWidth: 20,
          textAlign: 'right',
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

export default MailFolderItem
