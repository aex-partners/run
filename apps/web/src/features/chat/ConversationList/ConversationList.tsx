import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Users, UserPlus } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { ConversationItem } from '../ConversationItem/ConversationItem'

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

export interface Contact {
  kind: 'user' | 'eric'
  id: string
  name: string
  subtitle?: string
  image?: string
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
  onDelete?: (id: string) => void
  contacts?: Contact[]
  onOpenDm?: (peerUserId: string) => void
  onOpenEric?: () => void
}

const filterKeys: { key: FilterType; labelKey: string }[] = [
  { key: 'all', labelKey: 'chat.filterAll' },
  { key: 'unread', labelKey: 'chat.filterUnread' },
  { key: 'favorites', labelKey: 'chat.filterFavorites' },
  { key: 'groups', labelKey: 'chat.filterGroups' },
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
  onDelete,
  contacts = [],
  onOpenDm,
  onOpenEric,
}: ConversationListProps) {
  const { t } = useTranslation()
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

  const [prevConversations, setPrevConversations] = useState(conversations)
  if (conversations !== prevConversations) {
    setPrevConversations(conversations)
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

  const matchingContacts = query
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          (c.subtitle?.toLowerCase().includes(query) ?? false),
      )
    : []

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
      aria-label={t('chat.conversations')}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 16px 10px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 17 }}>{workspaceName}</span>
        <div ref={menuRef} style={{ position: 'relative' }} data-tour="new-conversation">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={t('chat.newConversation')}
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
            <Plus size={18} />
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
                {t('chat.newGroup')}
              </button>
              <button
                onClick={() => { setMenuOpen(false); onInviteMember?.() }}
                style={menuBtnStyle}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
              >
                <UserPlus size={14} />
                {t('chat.inviteMember')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 16px 4px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface-2)',
            borderRadius: 8,
            padding: '8px 11px',
            border: '1px solid var(--border)',
          }}
        >
          <Search size={15} color="var(--text-muted)" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('chat.searchPlaceholder')}
            aria-label={t('chat.searchPlaceholder')}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 14,
              width: '100%',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ padding: '8px 16px 10px', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        {filterKeys.map(({ key, labelKey }) => {
          const isActive = activeFilter === key
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              style={{
                padding: '5px 12px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                borderRadius: 14,
                border: isActive ? '1px solid var(--accent-border)' : '1px solid transparent',
                background: isActive ? 'var(--accent-light)' : 'var(--surface-2)',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t(labelKey)}
            </button>
          )
        })}
      </div>

      {/* Conversation list */}
      <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport style={{ height: '100%', overflowX: 'hidden' }}>
          <div style={{ paddingBottom: 8, width: 0, minWidth: '100%' }}>
            {query && sorted.length > 0 && (
              <div style={{ padding: '8px 16px 2px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {t('chat.conversationsSection')}
              </div>
            )}

            {sorted.length === 0 && matchingContacts.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                {query ? t('chat.noConversationsFound') : t('chat.noConversationsYet')}
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
                favorite={conv.favorite}
                muted={conv.muted}
                onClick={() => onSelect?.(conv.id)}
                onPin={onPin ? () => onPin(conv.id) : undefined}
                onFavorite={onFavorite ? () => onFavorite(conv.id) : undefined}
                onMute={onMute ? () => onMute(conv.id) : undefined}
                onDelete={onDelete ? () => onDelete(conv.id) : undefined}
              />
            ))}

            {matchingContacts.length > 0 && (
              <>
                <div style={{ padding: '12px 16px 2px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {t('chat.contactsSection')}
                </div>
                {matchingContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() =>
                      contact.kind === 'eric' ? onOpenEric?.() : onOpenDm?.(contact.id)
                    }
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 2,
                      padding: '10px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{contact.name}</span>
                    {contact.subtitle && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{contact.subtitle}</span>
                    )}
                  </button>
                ))}
              </>
            )}
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
