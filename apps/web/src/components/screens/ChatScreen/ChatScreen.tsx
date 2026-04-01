import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Users, Search, X, Sparkles, MessageSquarePlus, Database, ListTodo, Mic } from 'lucide-react'
import { Avatar } from '../../atoms/Avatar/Avatar'
import { ConversationList, type Conversation } from '../../organisms/ConversationList/ConversationList'
import { MessageThread, type ThreadMessage } from '../../organisms/MessageThread/MessageThread'
import type { PromptInputAttachment } from '../../organisms/PromptInput/PromptInput'
import { VoiceMode } from '../../organisms/VoiceMode/VoiceMode'
import { TaskBar } from '../../organisms/TaskBar/TaskBar'
import type { Task } from '../../organisms/TaskList/TaskList'

export interface ChatScreenProps {
  conversations: Conversation[]
  messages: ThreadMessage[]
  messagesByConversation?: Record<string, ThreadMessage[]>
  activeConversationId?: string
  workspaceName?: string
  onConversationSelect?: (id: string) => void
  onNewGroup?: () => void
  onInviteMember?: () => void
  onSendMessage?: (message: string) => void
  onPin?: (id: string) => void
  onFavorite?: (id: string) => void
  onMute?: (id: string) => void
  isTyping?: boolean
  tasks?: Task[]
  onCancelTask?: (id: string) => void
  onRetryTask?: (id: string) => void
  onViewTaskLogs?: (id: string) => void
  onTaskClick?: (id: string) => void
  onReact?: (messageId: string, emoji: string) => void
  onForwardMessages?: (messageIds: string[], recipientIds: string[]) => void
  onPinMessage?: (messageId: string) => void
  onStarMessage?: (messageId: string) => void
  onDeleteForEveryone?: (messageIds: string[]) => void
  onDeleteForMe?: (messageIds: string[]) => void
  onTranscriptionEdit?: (messageId: string, newText: string) => void
  promptAttachments?: PromptInputAttachment[]
  onAttachmentAdd?: (files: FileList) => void
  onAttachmentRemove?: (id: string) => void
  agents?: Array<{ id: string; name: string }>
  activeAgent?: { id: string; name: string } | null
  onSetAgent?: (agentId: string | null) => void
}

function getStatusLabelKey(conv: Conversation): string {
  if (conv.type === 'ai') return 'chat.aiAgent'
  if (conv.type === 'group' || conv.type === 'channel') return 'chat.group'
  if (conv.online) return 'chat.online'
  return 'chat.offline'
}

export function ChatScreen({
  conversations: conversationsProp,
  messages,
  messagesByConversation,
  activeConversationId: controlledId,
  workspaceName = 'Workspace',
  onConversationSelect,
  onNewGroup,
  onInviteMember,
  onSendMessage,
  onPin,
  onFavorite,
  onMute,
  isTyping: isTypingProp,
  tasks,
  onCancelTask,
  onRetryTask,
  onViewTaskLogs,
  onTaskClick,
  onReact,
  onForwardMessages,
  onPinMessage,
  onStarMessage,
  onDeleteForEveryone,
  onDeleteForMe,
  onTranscriptionEdit,
  promptAttachments,
  onAttachmentAdd,
  onAttachmentRemove,
  agents,
  activeAgent,
  onSetAgent,
}: ChatScreenProps) {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<Conversation[]>(conversationsProp)
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(
    controlledId ?? conversationsProp[0]?.id
  )
  const [taskBarOpen, setTaskBarOpen] = useState(false)
  const [voiceModeOpen, setVoiceModeOpen] = useState(false)
  const [agentSelectorOpen, setAgentSelectorOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const agentSelectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setConversations(conversationsProp)
  }, [conversationsProp])

  useEffect(() => {
    if (controlledId !== undefined) {
      setActiveConversationId(controlledId)
    }
  }, [controlledId])

  useEffect(() => {
    if (!agentSelectorOpen) return
    const handler = (e: MouseEvent) => {
      if (agentSelectorRef.current && !agentSelectorRef.current.contains(e.target as Node)) {
        setAgentSelectorOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [agentSelectorOpen])

  const handleConversationSelect = (id: string) => {
    setActiveConversationId(id)
    setSearchOpen(false)
    setSearchQuery('')
    onConversationSelect?.(id)
  }

  const toggleSearch = () => {
    setSearchOpen((prev) => {
      if (prev) setSearchQuery('')
      return !prev
    })
  }

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  const rawMessages =
    messagesByConversation && activeConversationId
      ? (messagesByConversation[activeConversationId] ?? messages)
      : messages

  const activeMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return rawMessages
    return rawMessages.filter((m) => m.content.toLowerCase().includes(q))
  }, [rawMessages, searchQuery])

  const activeConversation = conversations.find((c) => c.id === activeConversationId)
  const isGroup = activeConversation?.type === 'group' || activeConversation?.type === 'channel'
  const isAI = activeConversation?.type === 'ai'

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside
        data-tour="conversation-list"
        style={{
          width: 280,
          minWidth: 280,
          flexShrink: 0,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          workspaceName={workspaceName}
          onSelect={handleConversationSelect}
          onNewGroup={onNewGroup}
          onInviteMember={onInviteMember}
          onPin={onPin}
          onFavorite={onFavorite}
          onMute={onMute}
        />
      </aside>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div
          style={{
            padding: '0 20px',
            height: 52,
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          {activeConversation ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {activeConversation.type === 'ai' ? (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: activeConversation.agentName
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
                    {activeConversation.agentName
                      ? activeConversation.agentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                      : <Bot size={16} color="#fff" />}
                  </div>
                ) : isGroup ? (
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
                  <Avatar name={activeConversation.name} size="md" online={activeConversation.online} />
                )}

                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {activeAgent ? activeAgent.name : activeConversation.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {activeAgent ? t('chat.maestro') : t(getStatusLabelKey(activeConversation))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={toggleSearch}
                  style={{
                    background: searchOpen ? 'var(--accent-light)' : 'none',
                    border: 'none',
                    color: searchOpen ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 4,
                    display: 'flex',
                  }}
                  aria-label={t('chat.searchConversation')}
                >
                  <Search size={18} />
                </button>

                {/* Voice mode toggle */}
                {isAI && (
                  <button
                    onClick={() => setVoiceModeOpen((prev) => !prev)}
                    style={{
                      background: voiceModeOpen ? 'var(--accent-light)' : 'none',
                      border: 'none',
                      color: voiceModeOpen ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: 4,
                      display: 'flex',
                    }}
                    aria-label="Voice mode"
                  >
                    <Mic size={18} />
                  </button>
                )}

                {/* Task bar toggle */}
                <button
                  onClick={() => setTaskBarOpen((prev) => !prev)}
                  style={{
                    background: taskBarOpen ? 'var(--accent-light)' : 'none',
                    border: 'none',
                    color: taskBarOpen ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 4,
                    display: 'flex',
                  }}
                  aria-label={t('chat.toggleTasks')}
                >
                  <ListTodo size={18} />
                </button>

                {/* Agent selector for AI conversations */}
                {isAI && agents && agents.length > 0 && (
                  <div ref={agentSelectorRef} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setAgentSelectorOpen((prev) => !prev)}
                      style={{
                        background: agentSelectorOpen ? 'var(--accent-light)' : 'none',
                        border: 'none',
                        color: agentSelectorOpen ? 'var(--accent)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 4,
                        display: 'flex',
                      }}
                      aria-label={t('agents.selectAgent')}
                    >
                      <Bot size={18} />
                    </button>

                    {agentSelectorOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          marginTop: 4,
                          width: 180,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                          zIndex: 100,
                          overflow: 'hidden',
                        }}
                      >
                        <button
                          onClick={() => { onSetAgent?.(null); setAgentSelectorOpen(false) }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: !activeAgent ? 'var(--accent-light)' : 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 13,
                            color: !activeAgent ? 'var(--accent)' : 'var(--text)',
                            fontFamily: 'inherit',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = !activeAgent ? 'var(--accent-light)' : 'none' }}
                        >
                          {t('chat.defaultAgent')}
                        </button>
                        {agents.map((agent) => (
                          <button
                            key={agent.id}
                            onClick={() => { onSetAgent?.(agent.id); setAgentSelectorOpen(false) }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              background: activeAgent?.id === agent.id ? 'var(--accent-light)' : 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 13,
                              color: activeAgent?.id === agent.id ? 'var(--accent)' : 'var(--text)',
                              fontFamily: 'inherit',
                              textAlign: 'left',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = activeAgent?.id === agent.id ? 'var(--accent-light)' : 'none' }}
                          >
                            {agent.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t('chat.selectConversation')}</span>
          )}
        </div>

        {/* Search bar */}
        {searchOpen && activeConversation && (
          <div
            style={{
              padding: '6px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--surface)',
              flexShrink: 0,
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('chat.searchMessagesPlaceholder')}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
            {searchQuery && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                {activeMessages.length} {t('chat.searchResultCount')}
              </span>
            )}
            <button
              onClick={toggleSearch}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                borderRadius: 4,
              }}
              aria-label={t('chat.closeSearch')}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {activeConversation ? (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <MessageThread
                messages={activeMessages}
                onSend={onSendMessage}
                placeholder={`Message ${activeConversation.name}...`}
                isTyping={isTypingProp}
                showAuthor={isGroup}
                promptAttachments={promptAttachments}
                onAttachmentAdd={onAttachmentAdd}
                onAttachmentRemove={onAttachmentRemove}
                onReact={onReact}
                onForward={onForwardMessages}
                onPin={onPinMessage}
                onStar={onStarMessage}
                onDeleteForEveryone={onDeleteForEveryone}
                onDeleteForMe={onDeleteForMe}
                onTranscriptionEdit={onTranscriptionEdit}
                conversations={conversations}
              />
              {voiceModeOpen && isAI && (
                <VoiceMode
                  onSend={(msg) => onSendMessage?.(msg)}
                  onClose={() => setVoiceModeOpen(false)}
                  isTyping={isTypingProp}
                  agentName={activeAgent?.name ?? activeConversation.agentName ?? 'Eric'}
                  lastAIMessage={
                    [...activeMessages].reverse().find((m) => m.role === 'ai')?.content
                  }
                />
              )}
            </div>
            <TaskBar
              tasks={tasks ?? []}
              isOpen={taskBarOpen}
              onClose={() => setTaskBarOpen(false)}
              activeConversationId={activeConversationId}
              onCancel={onCancelTask}
              onRetry={onRetryTask}
              onViewLogs={onViewTaskLogs}
              onTaskClick={onTaskClick}
            />
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 32,
              padding: 40,
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Sparkles size={24} color="#fff" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>
                {t('chat.welcomeTitle')}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, maxWidth: 360 }}>
                {t('chat.welcomeDescription')}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 520 }}>
              {[
                { icon: <MessageSquarePlus size={16} />, label: t('chat.newConversationLabel'), desc: t('chat.newConversationDesc') },
                { icon: <Users size={16} />, label: t('chat.manageUsers'), desc: t('chat.manageUsersDesc') },
                { icon: <Database size={16} />, label: t('chat.queryData'), desc: t('chat.queryDataDesc') },
              ].map((item) => (
                <button
                  key={item.label}
                  style={{
                    flex: '1 1 150px',
                    maxWidth: 180,
                    padding: '14px 16px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
                    ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 1px var(--accent)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                    ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
                  }}
                >
                  <div style={{ color: 'var(--accent)', marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                    {item.icon}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {item.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatScreen
