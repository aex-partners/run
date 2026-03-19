import React from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import {
  Reply, ReplyAll, Forward, Archive, Trash2, Star, Paperclip,
  MoreHorizontal, Sparkles, ChevronDown, ArrowLeft, MailOpen, Clock, Tag,
} from 'lucide-react'
import { Avatar } from '../../atoms/Avatar/Avatar'
import { Button } from '../../atoms/Button/Button'

export interface MailAttachment {
  name: string
  size: string
  type: string
}

export interface MailMessage {
  id: string
  from: string
  fromEmail: string
  to: string[]
  cc?: string[]
  date: string
  content: string
  attachments?: MailAttachment[]
}

export interface MailDetailProps {
  subject: string
  starred?: boolean
  labels?: { name: string; color: string }[]
  messages: MailMessage[]
  aiSummary?: string
  aiDraft?: string
  onBack?: () => void
  emailPosition?: string
  onReply?: () => void
  onReplyAll?: () => void
  onForward?: () => void
  onArchive?: () => void
  onDelete?: () => void
  onStar?: () => void
  onApplyAiDraft?: () => void
}

function AttachmentChip({ name, size }: MailAttachment) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 10px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'var(--surface-2)',
      fontSize: 12,
      color: 'var(--text)',
      cursor: 'pointer',
    }}>
      <Paperclip size={12} color="var(--text-muted)" />
      <span>{name}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({size})</span>
    </div>
  )
}

function MessageItem({ message, isLast }: { message: MailMessage; isLast: boolean }) {
  const [collapsed, setCollapsed] = React.useState(!isLast)

  return (
    <div style={{
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      padding: '16px 0',
    }}>
      {/* Header */}
      <div
        onClick={() => !isLast && setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: isLast ? 'default' : 'pointer',
          marginBottom: collapsed ? 0 : 16,
        }}
      >
        <Avatar name={message.from} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{message.from}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>&lt;{message.fromEmail}&gt;</span>
          </div>
          {collapsed ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {message.content.slice(0, 80)}...
            </span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              to {message.to.join(', ')}
              {message.cc && message.cc.length > 0 && `, cc: ${message.cc.join(', ')}`}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {message.date}
        </span>
        {!isLast && (
          <ChevronDown
            size={14}
            color="var(--text-muted)"
            style={{ flexShrink: 0, transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }}
          />
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
              padding: '0 0 0 50px',
            }}
            dangerouslySetInnerHTML={{ __html: message.content }}
          />
          {message.attachments && message.attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingLeft: 50 }}>
              {message.attachments.map((att) => (
                <AttachmentChip key={att.name} {...att} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 6,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-muted)',
}

export function MailDetail({
  subject,
  starred = false,
  labels = [],
  messages,
  aiSummary,
  aiDraft,
  onBack,
  emailPosition,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
  onStar,
  onApplyAiDraft,
}: MailDetailProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexShrink: 0,
      }}>
        {onBack && (
          <button onClick={onBack} title="Back to list" style={iconBtnStyle}>
            <ArrowLeft size={18} />
          </button>
        )}
        <button onClick={onArchive} title="Archive" style={iconBtnStyle}><Archive size={16} /></button>
        <button onClick={onDelete} title="Delete" style={iconBtnStyle}><Trash2 size={16} /></button>
        <button title="Mark as unread" style={iconBtnStyle}><MailOpen size={16} /></button>
        <button title="Snooze" style={iconBtnStyle}><Clock size={16} /></button>
        <button title="Label" style={iconBtnStyle}><Tag size={16} /></button>
        <button title="More" style={iconBtnStyle}><MoreHorizontal size={16} /></button>
        <div style={{ flex: 1 }} />
        {emailPosition && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>{emailPosition}</span>
        )}
      </div>

      {/* Subject header */}
      <div style={{
        padding: '12px 20px',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0, flex: 1 }}>
            {subject}
          </h2>
          <button
            onClick={onStar}
            title={starred ? 'Unstar' : 'Star'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <Star size={16} fill={starred ? '#f59e0b' : 'none'} color={starred ? '#f59e0b' : 'var(--text-muted)'} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {labels.map((label) => (
            <span
              key={label.name}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 10,
                background: label.color + '20',
                color: label.color,
                textTransform: 'uppercase',
              }}
            >
              {label.name}
            </span>
          ))}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {messages.length} message{messages.length !== 1 ? 's' : ''} in thread
          </span>
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div style={{
          margin: '12px 20px 0',
          padding: '10px 14px',
          borderRadius: 8,
          background: 'var(--accent-light)',
          border: '1px solid var(--accent-border, #fed7aa)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          <Sparkles size={14} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', display: 'block', marginBottom: 2 }}>AI Summary</span>
            <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{aiSummary}</span>
          </div>
        </div>
      )}

      {/* Messages thread */}
      <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport style={{ height: '100%' }}>
          <div style={{ padding: '0 20px' }}>
            {messages.map((msg, i) => (
              <MessageItem key={msg.id} message={msg} isLast={i === messages.length - 1} />
            ))}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" style={{ width: 6 }}>
          <ScrollArea.Thumb style={{ background: 'var(--border)', borderRadius: 3 }} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      {/* AI Draft suggestion */}
      {aiDraft && (
        <div style={{
          margin: '0 20px 8px',
          padding: '10px 14px',
          borderRadius: 8,
          background: 'var(--accent-light)',
          border: '1px solid var(--accent-border, #fed7aa)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Sparkles size={12} color="var(--accent)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>AI Suggested Reply</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, margin: '0 0 8px' }}>{aiDraft}</p>
          <Button variant="primary" size="sm" onClick={onApplyAiDraft}>Use this reply</Button>
        </div>
      )}

      {/* Action bar */}
      <div style={{
        padding: '10px 20px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
      }}>
        <Button variant="secondary" size="sm" leftIcon={<Reply size={13} />} onClick={onReply}>Reply</Button>
        <Button variant="secondary" size="sm" leftIcon={<ReplyAll size={13} />} onClick={onReplyAll}>Reply All</Button>
        <Button variant="secondary" size="sm" leftIcon={<Forward size={13} />} onClick={onForward}>Forward</Button>
      </div>
    </div>
  )
}

export default MailDetail
