import React, { useState, useRef, useEffect } from 'react'
import { CornerUpLeft, Copy, Trash2, ChevronRight, SmilePlus, Forward, Pin, Star, Check, Ban } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { MessageBubble } from '../../molecules/MessageBubble/MessageBubble'
import { ActionCard } from '../../molecules/ActionCard/ActionCard'
import { DateSeparator } from '../../molecules/DateSeparator/DateSeparator'
import { Reasoning } from '../../molecules/Reasoning/Reasoning'
import { ChainOfThought, type ChainOfThoughtStep } from '../../molecules/ChainOfThought/ChainOfThought'
import { Sources, type Source } from '../../molecules/Sources/Sources'
import { PlanCard, type PlanStep } from '../../molecules/PlanCard/PlanCard'
import { QueueList, type QueueSection } from '../../molecules/QueueList/QueueList'
import { InlineTask, type InlineTaskFile } from '../../molecules/InlineTask/InlineTask'
import { Confirmation } from '../../molecules/Confirmation/Confirmation'
import { Suggestion } from '../../molecules/Suggestion/Suggestion'
import { Attachment } from '../../molecules/Attachment/Attachment'
import { ReactionBadge } from '../../atoms/ReactionBadge/ReactionBadge'
import { ReactionBar } from '../../molecules/ReactionBar/ReactionBar'
import { ForwardSelectionBar } from '../../molecules/ForwardSelectionBar/ForwardSelectionBar'
import { DeleteSelectionBar } from '../../molecules/DeleteSelectionBar/DeleteSelectionBar'
import { ForwardModal } from '../ForwardModal/ForwardModal'
import { DeleteConfirmModal } from '../DeleteConfirmModal/DeleteConfirmModal'
import { PromptInput, type PromptInputAttachment } from '../PromptInput/PromptInput'
import type { ToolState } from '../../molecules/Tool/Tool'
import type { Conversation } from '../ConversationList/ConversationList'
import { useTranslation } from 'react-i18next'

export interface MessageReaction {
  emoji: string
  count: number
  reacted: boolean
}

export interface ThreadMessage {
  id: string
  role: 'user' | 'ai' | 'system'
  content: string
  author: string
  timestamp?: string
  date?: string
  readStatus?: 'sent' | 'delivered' | 'read'
  replyTo?: { author: string; content: string }
  reactions?: MessageReaction[]
  pinned?: boolean
  starred?: boolean
  deleted?: boolean
  /** @deprecated Use confirmation instead */
  actionCard?: {
    question: string
    description?: string
    onConfirm?: () => void
    onDeny?: () => void
  }
  /** @deprecated Use suggestions instead */
  quickReplies?: {
    options: string[]
    onSelect?: (option: string) => void
  }
  toolExecution?: {
    summary: string
    detail?: string
  }
  attachments?: Array<{
    id: string
    fileName: string
    fileSize: string
    fileType: string
    thumbnailUrl?: string
  }>
  confirmation?: {
    title: string
    description?: string
    state: 'requested' | 'accepted' | 'rejected' | 'pending'
    onApprove?: () => void
    onReject?: () => void
  }
  suggestions?: {
    options: string[]
    onSelect?: (text: string) => void
  }
  reasoning?: {
    content: string
    isStreaming?: boolean
  }
  chainOfThought?: {
    steps: ChainOfThoughtStep[]
  }
  sources?: Source[]
  plan?: {
    title: string
    description?: string
    steps: PlanStep[]
    isStreaming?: boolean
  }
  queue?: {
    sections: QueueSection[]
  }
  inlineTask?: {
    title: string
    status: 'pending' | 'in-progress' | 'completed' | 'error'
    progress?: { current: number; total: number }
    files?: InlineTaskFile[]
  }
  toolInvocations?: Array<{
    id: string
    toolName: string
    state: ToolState
    input?: Record<string, unknown>
    output?: string
    error?: string
  }>
  audio?: {
    url: string
    duration: string
    waveform?: number[]
    transcription?: string
    transcriptionEdited?: boolean
  }
}

export interface MessageThreadProps {
  messages: ThreadMessage[]
  onSend?: (value: string) => void
  currentUser?: string
  placeholder?: string
  isTyping?: boolean
  showAuthor?: boolean
  promptAttachments?: PromptInputAttachment[]
  onAttachmentAdd?: (files: FileList) => void
  onAttachmentRemove?: (id: string) => void
  micState?: 'idle' | 'recording' | 'processing'
  onMicClick?: () => void
  onReact?: (messageId: string, emoji: string) => void
  onForward?: (messageIds: string[], recipientIds: string[]) => void
  onPin?: (messageId: string) => void
  onStar?: (messageId: string) => void
  onDeleteForEveryone?: (messageIds: string[]) => void
  onDeleteForMe?: (messageIds: string[]) => void
  onTranscriptionEdit?: (messageId: string, newText: string) => void
  conversations?: Conversation[]
}

const typingKeyframes = `
@keyframes aex-typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}
`

function injectTypingStyles() {
  if (typeof document === 'undefined') return
  const id = 'aex-typing-keyframes'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = typingKeyframes
    document.head.appendChild(style)
  }
}

function TypingIndicator() {
  const { t } = useTranslation()
  injectTypingStyles()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 0',
        color: 'var(--text-muted)',
        fontSize: 12,
      }}
    >
      <span>{t('ai.typing')}</span>
      <span style={{ display: 'flex', gap: 3, alignItems: 'center' }} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--text-muted)',
              animation: `aex-typing-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </span>
    </div>
  )
}

function ToolExecutionDetail({ summary, detail }: { summary: string; detail?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ maxWidth: '65%', padding: '6px 0' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 12,
          color: 'var(--text-muted)',
          fontFamily: 'inherit',
          padding: 0,
        }}
      >
        <ChevronRight
          size={12}
          style={{
            transition: 'transform 0.15s',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />
        {summary}
      </button>
      {open && detail && (
        <div
          style={{
            marginTop: 4,
            marginLeft: 18,
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {detail}
        </div>
      )}
    </div>
  )
}

type SelectionMode = 'none' | 'forward' | 'delete'

export function MessageThread({
  messages: initialMessages,
  onSend,
  currentUser = 'You',
  placeholder = 'Message...',
  isTyping = false,
  showAuthor = false,
  promptAttachments,
  onAttachmentAdd,
  onAttachmentRemove,
  micState,
  onMicClick,
  onReact,
  onForward,
  onPin,
  onStar,
  onDeleteForEveryone,
  onDeleteForMe,
  onTranscriptionEdit,
  conversations,
}: MessageThreadProps) {
  const { t } = useTranslation()
  const [localMessages, setLocalMessages] = useState<ThreadMessage[]>(initialMessages)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<{ id: string; author: string; content: string } | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  // Selection mode: none, forward, or delete
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('none')
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set())
  const [forwardModalOpen, setForwardModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  // Reaction bar state
  const [reactionBarMsgId, setReactionBarMsgId] = useState<string | null>(null)

  type MsgMenu = { x: number; y: number; messageId: string } | null
  const [msgMenu, setMsgMenu] = useState<MsgMenu>(null)
  const msgMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!msgMenu) return
    const handler = (e: MouseEvent) => {
      if (msgMenuRef.current && !msgMenuRef.current.contains(e.target as Node)) {
        setMsgMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [msgMenu])

  const [prevMessages, setPrevMessages] = useState(initialMessages)
  if (initialMessages !== prevMessages) {
    setPrevMessages(initialMessages)
    setLocalMessages(initialMessages)
  }

  const handleSend = (value: string) => {
    const msg: ThreadMessage = {
      id: String(Date.now()),
      role: 'user',
      content: value,
      author: currentUser,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      readStatus: 'sent',
      replyTo: replyingTo ? { author: replyingTo.author, content: replyingTo.content } : undefined,
    }
    setLocalMessages((prev) => [...prev, msg])
    onSend?.(value)
    setReplyingTo(null)
  }

  const handleReply = (id: string) => {
    const msg = localMessages.find((m) => m.id === id)
    if (!msg) return
    setReplyingTo({ id: msg.id, author: msg.author, content: msg.content })
    setMsgMenu(null)
  }

  const handleCopy = (id: string) => {
    const msg = localMessages.find((m) => m.id === id)
    if (!msg) return
    navigator.clipboard.writeText(msg.content).catch(() => {})
    setMsgMenu(null)
  }

  const handlePin = (id: string) => {
    setLocalMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m))
    )
    onPin?.(id)
    setMsgMenu(null)
  }

  const handleStar = (id: string) => {
    setLocalMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m))
    )
    onStar?.(id)
    setMsgMenu(null)
  }

  const handleReaction = (msgId: string, emoji: string) => {
    setLocalMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m
        const existing = m.reactions ?? []
        const idx = existing.findIndex((r) => r.emoji === emoji)
        let nextReactions: MessageReaction[]
        if (idx >= 0) {
          const r = existing[idx]
          if (r.reacted) {
            nextReactions = r.count <= 1
              ? existing.filter((_, i) => i !== idx)
              : existing.map((r2, i) => (i === idx ? { ...r2, count: r2.count - 1, reacted: false } : r2))
          } else {
            nextReactions = existing.map((r2, i) => (i === idx ? { ...r2, count: r2.count + 1, reacted: true } : r2))
          }
        } else {
          nextReactions = [...existing, { emoji, count: 1, reacted: true }]
        }
        return { ...m, reactions: nextReactions }
      })
    )
    onReact?.(msgId, emoji)
    setReactionBarMsgId(null)
  }

  // Forward mode
  const handleForwardMenuClick = (id: string) => {
    setSelectionMode('forward')
    setSelectedMessageIds(new Set([id]))
    setMsgMenu(null)
  }

  const handleForwardConfirm = (recipientIds: string[]) => {
    onForward?.(Array.from(selectedMessageIds), recipientIds)
    exitSelectionMode()
    setForwardModalOpen(false)
  }

  // Delete mode
  const handleDeleteMenuClick = (id: string) => {
    setSelectionMode('delete')
    setSelectedMessageIds(new Set([id]))
    setMsgMenu(null)
  }

  const handleDeleteForEveryone = () => {
    const ids = Array.from(selectedMessageIds)
    setLocalMessages((prev) =>
      prev.map((m) =>
        selectedMessageIds.has(m.id)
          ? { ...m, deleted: true, content: '', reactions: undefined, attachments: undefined, replyTo: undefined }
          : m
      )
    )
    onDeleteForEveryone?.(ids)
    exitSelectionMode()
  }

  const handleDeleteForMe = () => {
    const ids = Array.from(selectedMessageIds)
    setLocalMessages((prev) => prev.filter((m) => !selectedMessageIds.has(m.id)))
    onDeleteForMe?.(ids)
    exitSelectionMode()
  }

  const exitSelectionMode = () => {
    setSelectionMode('none')
    setSelectedMessageIds(new Set())
  }

  const toggleMessageSelection = (msg: ThreadMessage) => {
    // In delete mode, only user's own non-deleted messages can be selected
    if (selectionMode === 'delete' && (msg.role !== 'user' || msg.deleted)) return

    setSelectedMessageIds((prev) => {
      const next = new Set(prev)
      if (next.has(msg.id)) next.delete(msg.id)
      else next.add(msg.id)
      return next
    })
  }

  useEffect(() => {
    const el = viewportRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [localMessages, isTyping])

  // Build context menu items for a message
  const getMenuItems = (messageId: string) => {
    const msg = localMessages.find((m) => m.id === messageId)
    const isPinned = msg?.pinned
    const isStarred = msg?.starred
    const isUserMessage = msg?.role === 'user'

    const items: Array<{ label: string; icon: React.ReactNode; action: () => void; danger: boolean }> = [
      { label: t('chat.contextMenu.reply'), icon: <CornerUpLeft size={13} />, action: () => handleReply(messageId), danger: false },
      { label: t('chat.contextMenu.copy'), icon: <Copy size={13} />, action: () => handleCopy(messageId), danger: false },
      { label: t('chat.contextMenu.react'), icon: <SmilePlus size={13} />, action: () => { setReactionBarMsgId(messageId); setMsgMenu(null) }, danger: false },
      { label: t('chat.contextMenu.forward.label'), icon: <Forward size={13} />, action: () => handleForwardMenuClick(messageId), danger: false },
      { label: isPinned ? t('chat.contextMenu.unpin') : t('chat.contextMenu.pin'), icon: <Pin size={13} />, action: () => handlePin(messageId), danger: false },
      { label: isStarred ? t('chat.contextMenu.unstar') : t('chat.contextMenu.star'), icon: <Star size={13} />, action: () => handleStar(messageId), danger: false },
    ]

    // Delete only available for user's own messages
    if (isUserMessage) {
      items.push(
        { label: 'separator', icon: null, action: () => {}, danger: false },
        { label: t('chat.contextMenu.delete.label'), icon: <Trash2 size={13} />, action: () => handleDeleteMenuClick(messageId), danger: true },
      )
    }

    return items
  }

  const inSelectionMode = selectionMode !== 'none'

  // Group messages by date and compute spacing
  const renderMessages = () => {
    const elements: React.ReactNode[] = []
    let lastDate: string | undefined
    let lastAuthor: string | undefined

    for (let i = 0; i < localMessages.length; i++) {
      const msg = localMessages[i]
      const msgDate = msg.date

      // Insert date separator when date changes
      if (msgDate && msgDate !== lastDate) {
        elements.push(<DateSeparator key={`date-${msgDate}`} label={msgDate} />)
        lastAuthor = undefined
      }
      lastDate = msgDate

      const sameAuthor = msg.author === lastAuthor && msg.role !== 'system'
      const gap = sameAuthor ? 2 : 8
      const showReactionBar = !inSelectionMode && !msg.deleted && (hoveredId === msg.id || reactionBarMsgId === msg.id)

      // In delete mode, only non-deleted user messages are selectable
      const isSelectable = selectionMode === 'forward'
        || (selectionMode === 'delete' && msg.role === 'user' && !msg.deleted)

      elements.push(
        <div
          key={msg.id}
          style={{ position: 'relative', marginTop: i === 0 ? 0 : gap }}
          onMouseEnter={() => setHoveredId(msg.id)}
          onMouseLeave={() => {
            setHoveredId(null)
          }}
          onContextMenu={(e) => {
            if (inSelectionMode || msg.deleted) return
            e.preventDefault()
            setMsgMenu({ x: e.clientX, y: e.clientY, messageId: msg.id })
          }}
          onClick={inSelectionMode ? () => toggleMessageSelection(msg) : undefined}
        >
          {/* Selection mode checkbox */}
          {inSelectionMode && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: `2px solid ${
                    !isSelectable
                      ? 'transparent'
                      : selectedMessageIds.has(msg.id)
                        ? 'var(--accent)'
                        : 'var(--border)'
                  }`,
                  background: selectedMessageIds.has(msg.id) ? 'var(--accent)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  cursor: isSelectable ? 'pointer' : 'default',
                  marginTop: 4,
                  transition: 'all 0.15s',
                  visibility: isSelectable ? 'visible' : 'hidden',
                }}
              >
                {selectedMessageIds.has(msg.id) && <Check size={14} color="#fff" strokeWidth={3} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {renderMessageContent(msg)}
              </div>
            </div>
          )}

          {!inSelectionMode && (
            <>
              {/* Reaction bar (hover) */}
              {showReactionBar && (
                <div
                  style={{
                    position: 'absolute',
                    top: -4,
                    transform: 'translateY(-100%)',
                    right: msg.role === 'ai' ? undefined : 0,
                    left: msg.role === 'ai' ? 0 : undefined,
                    zIndex: 2,
                  }}
                >
                  <ReactionBar onReact={(emoji) => handleReaction(msg.id, emoji)} />
                </div>
              )}

              {renderMessageContent(msg)}
            </>
          )}
        </div>,
      )
      lastAuthor = msg.author
    }

    return elements
  }

  const renderMessageContent = (msg: ThreadMessage) => {
    // Deleted message placeholder
    if (msg.deleted) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              maxWidth: '65%',
              borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            <Ban size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-muted)' }}>
              {t('chat.contextMenu.delete.deletedMessage')}
            </span>
            {msg.timestamp && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6, whiteSpace: 'nowrap' }}>
                {msg.timestamp}
              </span>
            )}
          </div>
        </div>
      )
    }

    return (
    <>
      {/* Reasoning (above bubble) */}
      {msg.reasoning && (
        <div style={{ maxWidth: '65%', marginBottom: 4 }}>
          <Reasoning content={msg.reasoning.content} isStreaming={msg.reasoning.isStreaming} />
        </div>
      )}

      {/* ChainOfThought (above bubble) */}
      {msg.chainOfThought && (
        <div style={{ maxWidth: '65%', marginBottom: 4 }}>
          <ChainOfThought steps={msg.chainOfThought.steps} />
        </div>
      )}

      {/* Message bubble or tool execution */}
      {msg.toolExecution ? (
        <ToolExecutionDetail
          summary={msg.toolExecution.summary}
          detail={msg.toolExecution.detail}
        />
      ) : (
        <MessageBubble
          role={msg.role}
          content={msg.content}
          author={msg.author}
          timestamp={msg.timestamp}
          showAuthor={showAuthor && msg.role !== 'user'}
          readStatus={msg.readStatus}
          replyTo={msg.replyTo}
          pinned={msg.pinned}
          starred={msg.starred}
          audio={msg.audio}
          isOwner={msg.role === 'user'}
          onTranscriptionEdit={msg.audio ? (newText: string) => {
            setLocalMessages((prev) =>
              prev.map((m) =>
                m.id === msg.id
                  ? { ...m, audio: m.audio ? { ...m.audio, transcription: newText, transcriptionEdited: true } : m.audio }
                  : m
              )
            )
            onTranscriptionEdit?.(msg.id, newText)
          } : undefined}
        />
      )}

      {/* Reactions display */}
      {msg.reactions && msg.reactions.length > 0 && (
        <div
          style={{
            marginTop: 4,
            maxWidth: '65%',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}
        >
          {msg.reactions.map((reaction) => (
            <ReactionBadge
              key={reaction.emoji}
              emoji={reaction.emoji}
              count={reaction.count}
              reacted={reaction.reacted}
              onClick={() => handleReaction(msg.id, reaction.emoji)}
            />
          ))}
        </div>
      )}

      {/* Attachments (grid, below bubble) */}
      {msg.attachments && msg.attachments.length > 0 && (
        <div style={{ marginTop: 6, maxWidth: '65%', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {msg.attachments.map((att) => (
            <Attachment
              key={att.id}
              fileName={att.fileName}
              fileSize={att.fileSize}
              fileType={att.fileType}
              thumbnailUrl={att.thumbnailUrl}
              variant="grid"
            />
          ))}
        </div>
      )}

      {/* PlanCard (below) */}
      {msg.plan && (
        <div style={{ marginTop: 8, maxWidth: '65%' }}>
          <PlanCard
            title={msg.plan.title}
            description={msg.plan.description}
            steps={msg.plan.steps}
            isStreaming={msg.plan.isStreaming}
            defaultOpen
          />
        </div>
      )}

      {/* InlineTask (below) */}
      {msg.inlineTask && (
        <div style={{ marginTop: 8, maxWidth: '65%' }}>
          <InlineTask
            title={msg.inlineTask.title}
            status={msg.inlineTask.status}
            progress={msg.inlineTask.progress}
            files={msg.inlineTask.files}
            defaultOpen
          />
        </div>
      )}

      {/* QueueList (below) */}
      {msg.queue && (
        <div style={{ marginTop: 8, maxWidth: '65%' }}>
          <QueueList sections={msg.queue.sections} defaultOpen />
        </div>
      )}

      {/* Sources (below) */}
      {msg.sources && msg.sources.length > 0 && (
        <div style={{ marginTop: 8, maxWidth: '65%' }}>
          <Sources sources={msg.sources} defaultOpen />
        </div>
      )}

      {/* Confirmation (replaces ActionCard if present) */}
      {msg.confirmation ? (
        <div style={{ marginTop: 8, maxWidth: '65%' }}>
          <Confirmation
            title={msg.confirmation.title}
            description={msg.confirmation.description}
            state={msg.confirmation.state}
            onApprove={msg.confirmation.onApprove}
            onReject={msg.confirmation.onReject}
          />
        </div>
      ) : msg.actionCard ? (
        <div style={{ marginTop: 8, maxWidth: '65%' }}>
          <ActionCard
            question={msg.actionCard.question}
            description={msg.actionCard.description}
            onConfirm={msg.actionCard.onConfirm}
            onDeny={msg.actionCard.onDeny}
          />
        </div>
      ) : null}

      {/* Suggestions (replaces quickReplies if present) */}
      {msg.suggestions ? (
        <div style={{ marginTop: 10, maxWidth: '65%' }}>
          <Suggestion suggestions={msg.suggestions.options} onSelect={msg.suggestions.onSelect} />
        </div>
      ) : msg.quickReplies && msg.quickReplies.options.length > 0 ? (
        <div
          style={{
            marginTop: 10,
            maxWidth: '65%',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {msg.quickReplies.options.map((option) => (
            <button
              key={option}
              onClick={() => msg.quickReplies?.onSelect?.(option)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontFamily: 'inherit',
                fontWeight: 500,
                color: 'var(--accent)',
                background: 'var(--accent-light, #fff5f0)',
                border: '1px solid var(--accent-border, #fed7aa)',
                borderRadius: 20,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.background = 'var(--accent)'
                el.style.color = '#fff'
                el.style.borderColor = 'var(--accent)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.background = 'var(--accent-light, #fff5f0)'
                el.style.color = 'var(--accent)'
                el.style.borderColor = 'var(--accent-border, #fed7aa)'
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </>
    )
  }

  // Determine which bottom bar to show
  const renderBottomBar = () => {
    if (selectionMode === 'forward') {
      return (
        <ForwardSelectionBar
          selectedCount={selectedMessageIds.size}
          onCancel={exitSelectionMode}
          onForward={() => setForwardModalOpen(true)}
        />
      )
    }
    if (selectionMode === 'delete') {
      return (
        <DeleteSelectionBar
          selectedCount={selectedMessageIds.size}
          onCancel={exitSelectionMode}
          onDelete={() => setDeleteModalOpen(true)}
        />
      )
    }
    return (
      <PromptInput
        onSend={handleSend}
        placeholder={placeholder}
        replyTo={replyingTo ? { author: replyingTo.author, content: replyingTo.content } : null}
        onCancelReply={() => setReplyingTo(null)}
        attachments={promptAttachments}
        onAttachmentAdd={onAttachmentAdd}
        onAttachmentRemove={onAttachmentRemove}
        micState={micState}
        onMicClick={onMicClick}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport ref={viewportRef} style={{ height: '100%' }}>
          {localMessages.length === 0 && !isTyping ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No messages yet. Start the conversation!
            </div>
          ) : (
            <div
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column' }}
            >
              {renderMessages()}

              {isTyping && (
                <div style={{ marginTop: 8 }}>
                  <TypingIndicator />
                </div>
              )}
            </div>
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" style={{ width: 4, padding: 2 }}>
          <ScrollArea.Thumb style={{ background: 'var(--border)', borderRadius: 2 }} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      {/* Bottom bar */}
      {renderBottomBar()}

      {/* Context menu */}
      {msgMenu && (
        <div
          ref={msgMenuRef}
          style={{
            position: 'fixed',
            left: msgMenu.x,
            top: msgMenu.y,
            zIndex: 1000,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            minWidth: 140,
          }}
        >
          {getMenuItems(msgMenu.messageId).map(({ label, icon, action, danger }) => {
            if (label === 'separator') {
              return <div key="sep" style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            }
            return (
              <button
                key={label}
                onClick={action}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: danger ? 'var(--danger, #dc2626)' : 'var(--text)',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
              >
                <span style={{ fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center' }}>{icon}</span>
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Forward Modal */}
      {conversations && (
        <ForwardModal
          open={forwardModalOpen}
          onOpenChange={setForwardModalOpen}
          conversations={conversations}
          onConfirm={handleForwardConfirm}
        />
      )}

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onDeleteForEveryone={handleDeleteForEveryone}
        onDeleteForMe={handleDeleteForMe}
      />
    </div>
  )
}

export default MessageThread
