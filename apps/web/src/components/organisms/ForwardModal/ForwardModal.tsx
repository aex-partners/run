import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Search, X, Bot, Users, Check } from 'lucide-react'
import { Avatar } from '../../atoms/Avatar/Avatar'
import type { Conversation } from '../ConversationList/ConversationList'
import { useTranslation } from 'react-i18next'

export interface ForwardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversations: Conversation[]
  onConfirm: (recipientIds: string[]) => void
}

export function ForwardModal({ open, onOpenChange, conversations, onConfirm }: ForwardModalProps) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchText, setSearchText] = useState('')

  const filtered = conversations.filter((c) => {
    const q = searchText.toLowerCase()
    return c.name.toLowerCase().includes(q) || (c.lastMessage?.toLowerCase().includes(q))
  })

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds))
    setSelectedIds(new Set())
    setSearchText('')
    onOpenChange(false)
  }

  const handleCancel = () => {
    setSelectedIds(new Set())
    setSearchText('')
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1000,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 420,
            maxHeight: '80vh',
            background: 'var(--surface)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Dialog.Title style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              {t('chat.contextMenu.forward.title')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 4,
                  borderRadius: 4,
                  display: 'flex',
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div style={{ padding: '12px 20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: 'var(--surface-2)',
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            >
              <Search size={14} color="var(--text-muted)" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t('chat.contextMenu.forward.search')}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'none',
                  outline: 'none',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  color: 'var(--text)',
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {t('chat.contextMenu.forward.noResults')}
              </div>
            ) : (
              filtered.map((conv) => {
                const selected = selectedIds.has(conv.id)
                return (
                  <button
                    key={conv.id}
                    onClick={() => toggleId(conv.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: selected ? 'var(--accent-light)' : 'none',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'
                    }}
                    onMouseLeave={(e) => {
                      if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'none'
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                        background: selected ? 'var(--accent)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.15s',
                      }}
                    >
                      {selected && <Check size={12} color="#fff" strokeWidth={3} />}
                    </div>

                    {/* Avatar */}
                    {conv.type === 'ai' ? (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: conv.agentName
                            ? 'linear-gradient(135deg, #EA580C, #C4490A)'
                            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#fff',
                        }}
                      >
                        {conv.agentName
                          ? conv.agentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                          : <Bot size={16} color="#fff" />}
                      </div>
                    ) : conv.type === 'group' || conv.type === 'channel' ? (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'var(--surface-2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          border: '1px solid var(--border)',
                        }}
                      >
                        <Users size={16} color="var(--text-muted)" />
                      </div>
                    ) : (
                      <Avatar name={conv.name} size="md" online={conv.online} />
                    )}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.name}
                      </div>
                      {conv.lastMessage && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.lastMessage}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              onClick={handleCancel}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'inherit',
                color: 'var(--text)',
              }}
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: selectedIds.size === 0 ? 'var(--border)' : 'var(--accent)',
                cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                color: '#fff',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (selectedIds.size > 0) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-hover)'
              }}
              onMouseLeave={(e) => {
                if (selectedIds.size > 0) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)'
              }}
            >
              {t('chat.contextMenu.forward.action')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default ForwardModal
