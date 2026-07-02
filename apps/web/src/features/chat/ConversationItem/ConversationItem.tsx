import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Users, Pin, Star, BellOff, Trash2 } from 'lucide-react'
import { Avatar } from '../../../shared/ui/Avatar/Avatar'

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
  favorite?: boolean
  muted?: boolean
  onClick?: () => void
  onPin?: () => void
  onFavorite?: () => void
  onMute?: () => void
  onDelete?: () => void
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
  favorite = false,
  muted = false,
  onClick,
  onPin,
  onFavorite,
  onMute,
  onDelete,
}: ConversationItemProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)
  const hasUnread = unreadCount != null && unreadCount > 0
  const isGroup = type === 'group' || type === 'channel'

  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctxMenu])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setCtxMenu(null)
    }
  }, [])

  const ctxItemStyle: React.CSSProperties = {
    width: '100%',
    padding: '7px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--text)',
    fontFamily: 'inherit',
    textAlign: 'left',
  }

  const menuItems = [
    onPin && { key: 'pin', label: pinned ? t('chat.conversationMenu.unpin') : t('chat.conversationMenu.pin'), icon: <Pin size={14} />, action: onPin, danger: false },
    onFavorite && { key: 'favorite', label: favorite ? t('chat.conversationMenu.unfavorite') : t('chat.conversationMenu.favorite'), icon: <Star size={14} />, action: onFavorite, danger: false },
    onMute && { key: 'mute', label: muted ? t('chat.conversationMenu.unmute') : t('chat.conversationMenu.mute'), icon: <BellOff size={14} />, action: onMute, danger: false },
    onDelete && { key: 'delete', label: t('chat.conversationMenu.delete'), icon: <Trash2 size={14} />, action: onDelete, danger: true },
  ].filter(Boolean) as Array<{ key: string; label: string; icon: React.ReactNode; action: () => void; danger: boolean }>

  return (
    <>
      <button
        onClick={onClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-current={active ? 'true' : undefined}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
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
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid var(--border)',
            }}
          >
            <Users size={22} color="var(--text-muted)" />
          </div>
        ) : type === 'ai' ? (
          <div
            aria-hidden="true"
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: agentName ? 'linear-gradient(135deg, var(--accent), var(--accent-hover))' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {agentName ? agentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : <Bot size={22} color="#fff" />}
          </div>
        ) : (
          <Avatar name={name} size="xl" online={online} />
        )}

        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {/* Row 1: name + pin icon + timestamp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <span
              style={{
                fontSize: 16,
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
                fontSize: 12.5,
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
                fontSize: 14.5,
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
                aria-label={t('chat.conversationItem.unreadMessages', { count: unreadCount })}
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  background: 'var(--success)',
                  color: '#fff',
                  fontSize: 11,
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

      {ctxMenu && (
        <div
          ref={ctxRef}
          role="menu"
          aria-label={t('chat.conversationItem.conversationOptions', { name })}
          onKeyDown={handleKeyDown}
          style={{
            position: 'fixed',
            top: ctxMenu.y,
            left: ctxMenu.x,
            width: 170,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 9999,
            overflow: 'hidden',
            padding: '4px 0',
          }}
        >
          {menuItems.map((item, index) => (
            <button
              key={item.key}
              role="menuitem"
              tabIndex={0}
              onClick={() => { item.action(); setCtxMenu(null) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  item.action()
                  setCtxMenu(null)
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  const next = ctxRef.current?.querySelectorAll('[role="menuitem"]')[index + 1] as HTMLElement
                  next?.focus()
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  const prev = ctxRef.current?.querySelectorAll('[role="menuitem"]')[index - 1] as HTMLElement
                  prev?.focus()
                }
              }}
              style={{ ...ctxItemStyle, color: item.danger ? 'var(--danger, #dc2626)' : 'var(--text)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export default ConversationItem
