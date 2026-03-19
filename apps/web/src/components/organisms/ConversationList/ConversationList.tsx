import React, { useState, useRef, useEffect } from 'react'
import { Plus, Search, Users, UserPlus } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { ConversationItem } from '../../molecules/ConversationItem/ConversationItem'

export interface Conversation {
  id: string
  name: string
  lastMessage: string
  timestamp: string
  unreadCount?: number
  type: 'dm' | 'group' | 'channel' | 'ai'
  online?: boolean
  agentName?: string
  agentAvatar?: string
  pinned?: boolean
  favorite?: boolean
  muted?: boolean
  lastActivityAt?: number
}

export type FilterType = 'all' | 'unread' | 'favorites' | 'groups'

export interface ConversationListProps {
  conversations: Conversation[]
  activeId?: string
  workspaceName?: string
  onSelect?: (id: string) => void
  onNewGroup?: () => void
  onInviteMember?: () => void
  onPin?: (id: string) => void
  onFavorite?: (id: string) => void
  onMute?: (id: string) => void
}

const filterLabels: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'groups', label: 'Groups' },
]

export function ConversationList({
  conversations,
  activeId,
  workspaceName = 'Workspace',
  onSelect,
  onNewGroup,
  onInviteMember,
  onPin,
  onFavorite,
  onMute,
}: ConversationListProps) {
  const [searchText, setSearchText] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [localConversations, setLocalConversations] = useState<Conversation[]>(conversations)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const [prevProp, setPrevProp] = useState(conversations)
  if (conversations !== prevProp) {
    setPrevProp(conversations)
    setLocalConversations(conversations)
  }

  const query = searchText.trim().toLowerCase()

  let filtered = query
    ? localConversations.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.lastMessage.toLowerCase().includes(query),
      )
    : localConversations

  if (activeFilter === 'unread') {
    filtered = filtered.filter((c) => c.unreadCount && c.unreadCount > 0)
  } else if (activeFilter === 'favorites') {
    filtered = filtered.filter((c) => c.favorite)
  } else if (activeFilter === 'groups') {
    filtered = filtered.filter((c) => c.type === 'group' || c.type === 'channel')
  }

  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return 0
  })

  const menuBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
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

  return (
    <div
      role="region"
      aria-label="Conversations"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 12px 8px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>{workspaceName}</span>
        <div ref={menuRef} style={{ position: 'relative' }} data-tour="new-conversation">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="New conversation"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
            }}
          >
            <Plus size={16} />
          </button>

          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                width: 190,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                zIndex: 100,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => { setMenuOpen(false); onNewGroup?.() }}
                style={menuBtnStyle}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
              >
                <Users size={14} />
                New Group
              </button>
              <button
                onClick={() => { setMenuOpen(false); onInviteMember?.() }}
                style={menuBtnStyle}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
              >
                <UserPlus size={14} />
                Invite Member
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 12px 4px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--surface-2)',
            borderRadius: 6,
            padding: '5px 8px',
            border: '1px solid var(--border)',
          }}
        >
          <Search size={13} color="var(--text-muted)" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search..."
            aria-label="Search conversations"
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 12,
              width: '100%',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ padding: '6px 12px 8px', display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
        {filterLabels.map(({ key, label }) => {
          const isActive = activeFilter === key
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              style={{
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'inherit',
                borderRadius: 12,
                border: isActive ? '1px solid var(--accent-border)' : '1px solid transparent',
                background: isActive ? 'var(--accent-light)' : 'var(--surface-2)',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Conversation list */}
      <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport style={{ height: '100%', overflowX: 'hidden' }}>
          <div style={{ paddingBottom: 8, width: 0, minWidth: '100%' }}>
            {sorted.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                {query ? 'No conversations found.' : 'No conversations yet.'}
              </div>
            )}

            {sorted.map((conv) => (
              <ConversationItem
                key={conv.id}
                name={conv.name}
                lastMessage={conv.lastMessage}
                timestamp={conv.timestamp}
                unreadCount={conv.unreadCount}
                active={activeId === conv.id}
                type={conv.type}
                online={conv.online}
                agentName={conv.agentName}
                pinned={conv.pinned}
                onClick={() => onSelect?.(conv.id)}
              />
            ))}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" style={{ width: 4 }}>
          <ScrollArea.Thumb style={{ background: 'var(--border)', borderRadius: 2 }} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  )
}

export default ConversationList
