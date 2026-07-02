import React, { useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Pin, Star } from 'lucide-react'
import { ReadReceipt } from '../ReadReceipt/ReadReceipt'
import { ReplyQuote } from '../ReplyQuote/ReplyQuote'
import { AudioBubble } from '../AudioBubble/AudioBubble'
import { useTranslation } from 'react-i18next'

export interface MessageBubbleProps {
  role: 'user' | 'ai' | 'system'
  content: string
  author: string
  timestamp?: string
  avatar?: string
  showAuthor?: boolean
  readStatus?: 'sent' | 'delivered' | 'read'
  replyTo?: { author: string; content: string }
  pinned?: boolean
  starred?: boolean
  audio?: {
    url: string
    duration: string
    waveform?: number[]
    transcription?: string
    transcriptionEdited?: boolean
  }
  isOwner?: boolean
  /** True when the message belongs to the current user (right side, accent bubble). */
  isOwn?: boolean
  onTranscriptionEdit?: (newText: string) => void
}

const markdownStyles: Record<string, React.CSSProperties> = {
  p: { margin: '0 0 12px 0', lineHeight: 1.7 },
  pLast: { margin: 0 },
  ul: { margin: '8px 0', paddingLeft: 24 },
  ol: { margin: '8px 0', paddingLeft: 24 },
  li: { marginBottom: 4, lineHeight: 1.6 },
  code: {
    background: 'var(--surface-2)',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 13,
    fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace",
  },
  pre: {
    background: 'var(--surface-2)',
    padding: '12px 16px',
    borderRadius: 8,
    overflow: 'auto',
    fontSize: 13,
    margin: '12px 0',
    border: '1px solid var(--border)',
  },
  h1: { fontSize: 18, fontWeight: 700, margin: '20px 0 8px', letterSpacing: '-0.02em' },
  h2: { fontSize: 16, fontWeight: 600, margin: '18px 0 6px', letterSpacing: '-0.01em' },
  h3: { fontSize: 15, fontWeight: 600, margin: '14px 0 4px' },
  blockquote: {
    borderLeft: '3px solid var(--accent)',
    paddingLeft: 14,
    margin: '12px 0',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  hr: {
    border: 'none',
    borderTop: '1px solid var(--border)',
    margin: '16px 0',
  },
  table: {
    borderCollapse: 'collapse' as const,
    width: '100%',
    margin: '12px 0',
    fontSize: 13,
  },
  th: {
    borderBottom: '2px solid var(--border)',
    padding: '8px 12px',
    textAlign: 'left' as const,
    fontWeight: 600,
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
  },
  td: {
    borderBottom: '1px solid var(--border)',
    padding: '8px 12px',
  },
}

export function MessageBubble({ role, content, author, timestamp, showAuthor = false, readStatus, replyTo, pinned, starred, audio, isOwner, isOwn, onTranscriptionEdit }: MessageBubbleProps) {
  const { t } = useTranslation()
  const isSystem = role === 'system'
  const isAssistant = role === 'ai'
  // "own" = current user's message (right, accent). Falls back to role for AI chats.
  const isUser = isOwn ?? (role === 'user')

  const components = useMemo(() => ({
    p: ({ children, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
      <p {...props} style={markdownStyles.p}>{children}</p>
    ),
    ul: ({ children, ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
      <ul {...props} style={markdownStyles.ul}>{children}</ul>
    ),
    ol: ({ children, ...props }: React.ComponentPropsWithoutRef<'ol'>) => (
      <ol {...props} style={markdownStyles.ol}>{children}</ol>
    ),
    li: ({ children, ...props }: React.ComponentPropsWithoutRef<'li'>) => (
      <li {...props} style={markdownStyles.li}>{children}</li>
    ),
    code: ({ children, className, ...props }: React.ComponentPropsWithoutRef<'code'>) => {
      const isBlock = className?.startsWith('language-')
      if (isBlock) {
        return (
          <pre style={markdownStyles.pre}>
            <code {...props} style={{ fontFamily: 'monospace' }}>{children}</code>
          </pre>
        )
      }
      return <code {...props} style={markdownStyles.code}>{children}</code>
    },
    pre: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    h1: ({ children, ...props }: React.ComponentPropsWithoutRef<'h1'>) => (
      <h1 {...props} style={markdownStyles.h1}>{children}</h1>
    ),
    h2: ({ children, ...props }: React.ComponentPropsWithoutRef<'h2'>) => (
      <h2 {...props} style={markdownStyles.h2}>{children}</h2>
    ),
    h3: ({ children, ...props }: React.ComponentPropsWithoutRef<'h3'>) => (
      <h3 {...props} style={markdownStyles.h3}>{children}</h3>
    ),
    blockquote: ({ children, ...props }: React.ComponentPropsWithoutRef<'blockquote'>) => (
      <blockquote {...props} style={markdownStyles.blockquote}>{children}</blockquote>
    ),
    a: ({ children, href, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
      <a {...props} href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
        {children}
      </a>
    ),
    hr: () => <hr style={markdownStyles.hr} />,
    table: ({ children, ...props }: React.ComponentPropsWithoutRef<'table'>) => (
      <table {...props} style={markdownStyles.table}>{children}</table>
    ),
    th: ({ children, ...props }: React.ComponentPropsWithoutRef<'th'>) => (
      <th {...props} style={markdownStyles.th}>{children}</th>
    ),
    td: ({ children, ...props }: React.ComponentPropsWithoutRef<'td'>) => (
      <td {...props} style={markdownStyles.td}>{children}</td>
    ),
    strong: ({ children }: { children: React.ReactNode }) => (
      <strong style={{ fontWeight: 600, color: 'var(--text)' }}>{children}</strong>
    ),
  }), [])

  if (isSystem) {
    return (
      <div
        role="article"
        aria-label={t('messageBubble.messageFrom', { author })}
        style={{
          textAlign: 'center',
          padding: '4px 12px',
          fontSize: 11,
          color: 'var(--text-muted)',
          background: 'var(--surface-2)',
          borderRadius: 12,
          display: 'inline-block',
          alignSelf: 'center',
        }}
      >
        {content}
      </div>
    )
  }

  const timestampEl = timestamp && (
    <span
      style={{
        fontSize: 11,
        color: 'var(--text-muted)',
        marginLeft: 8,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        float: 'right',
        marginTop: 4,
      }}
    >
      {audio?.transcriptionEdited && (
        <span style={{ fontStyle: 'italic', marginRight: 2 }}>{t('audio.edited')}</span>
      )}
      {pinned && <Pin size={10} style={{ transform: 'rotate(45deg)', color: 'var(--text-muted)' }} />}
      {starred && <Star size={10} style={{ fill: 'var(--accent)', stroke: 'var(--accent)', strokeWidth: 0 }} />}
      {timestamp}
      {isUser && readStatus && <ReadReceipt status={readStatus} />}
    </span>
  )

  return (
    <div
      role="article"
      aria-label={t('messageBubble.messageFrom', { author })}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={
          isAssistant
            ? {
                // AI replies get a neutral container (vs the user's accent bubble)
                // so a glance tells you who spoke; was bare flush-left text before.
                maxWidth: '90%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '4px 18px 18px 18px',
                padding: '10px 14px',
                fontSize: 14,
                color: 'var(--text)',
                lineHeight: 1.7,
                boxShadow: '0 1px 1.5px rgba(0,0,0,0.05)',
              }
            : isUser
              ? {
                  maxWidth: '65%',
                  background: 'var(--accent-light)',
                  borderRadius: '18px 18px 4px 18px',
                  padding: '9px 14px',
                  fontSize: 15,
                  color: 'var(--text)',
                  lineHeight: 1.45,
                  border: '1px solid var(--accent-border)',
                  boxShadow: '0 1px 1.5px rgba(0,0,0,0.08)',
                  wordBreak: 'break-word',
                }
              : {
                  maxWidth: '65%',
                  background: 'var(--surface)',
                  borderRadius: '18px 18px 18px 4px',
                  padding: '9px 14px',
                  fontSize: 15,
                  color: 'var(--text)',
                  lineHeight: 1.45,
                  border: '1px solid var(--border)',
                  boxShadow: '0 1px 1.5px rgba(0,0,0,0.08)',
                  wordBreak: 'break-word',
                }
        }
      >
        {replyTo && <ReplyQuote author={replyTo.author} content={replyTo.content} />}

        {showAuthor && !isUser && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>
            {author}
          </div>
        )}

        {audio ? (
          <div>
            <AudioBubble
              url={audio.url}
              duration={audio.duration}
              waveform={audio.waveform}
              transcription={audio.transcription}
              transcriptionEdited={audio.transcriptionEdited}
              isOwner={isOwner ?? isUser}
              onTranscriptionEdit={onTranscriptionEdit}
            />
            {timestampEl}
          </div>
        ) : isAssistant ? (
          <div>
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={components as React.ComponentProps<typeof Markdown>['components']}
            >
              {content}
            </Markdown>
            {timestampEl}
          </div>
        ) : (
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {content}
            {timestampEl}
          </span>
        )}
      </div>
    </div>
  )
}

export default MessageBubble
