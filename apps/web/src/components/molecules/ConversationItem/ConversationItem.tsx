import React, { useState } from 'react'
import { Bot, Users, Pin } from 'lucide-react'
import { Avatar } from '../../atoms/Avatar/Avatar'

export interface ConversationItemProps {
  name: string
  lastMessage: string
  timestamp: string
  unreadCount?: number
  active?: boolean
  type?: 'dm' | 'group' | 'channel' | 'ai'
  online?: boolean
  agentName?: string
  pinned?: boolean
  onClick?: () => void
}

export function ConversationItem({
  name,
  lastMessage,
  timestamp,
  unreadCount,
  active = false,
  type = 'dm',
  online = false,
  agentName,
  pinned = false,
  onClick,
}: ConversationItemProps) {
  const [hovered, setHovered] = useState(false)
  const hasUnread = unreadCount != null && unreadCount > 0
  const isGroup = type === 'group' || type === 'channel'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={active ? 'true' : undefined}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: active ? 'var(--surface-2)' : hovered ? 'var(--surface-2)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* Avatar */}
      {isGroup ? (
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid var(--border)',
          }}
        >
          <Users size={18} color="var(--text-muted)" />
        </div>
      ) : type === 'ai' ? (
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: agentName ? 'linear-gradient(135deg, #EA580C, #C4490A)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          {agentName ? agentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : <Bot size={18} color="#fff" />}
        </div>
      ) : (
        <Avatar name={name} size="md" online={online} />
      )}

      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* Row 1: name + pin icon + timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: hasUnread ? 600 : 400,
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              minWidth: 0,
            }}
          >
            {name}
          </span>
          {pinned && (
            <Pin size={12} color="var(--text-muted)" style={{ flexShrink: 0, transform: 'rotate(45deg)' }} />
          )}
          <span
            style={{
              fontSize: 11,
              color: hasUnread ? 'var(--success)' : 'var(--text-muted)',
              flexShrink: 0,
              fontWeight: hasUnread ? 500 : 400,
            }}
          >
            {timestamp}
          </span>
        </div>
        {/* Row 2: last message + unread badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              minWidth: 0,
            }}
          >
            {lastMessage}
          </span>
          {hasUnread && (
            <div
              aria-label={`${unreadCount} unread messages`}
              style={{
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                background: 'var(--success)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 5px',
                flexShrink: 0,
              }}
            >
              {unreadCount}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

export default ConversationItem
