import React from 'react'
import Markdown from 'react-markdown'
import { Pin, Star } from 'lucide-react'
import { ReadReceipt } from '../../atoms/ReadReceipt/ReadReceipt'
import { ReplyQuote } from '../ReplyQuote/ReplyQuote'
import { AudioBubble } from '../AudioBubble/AudioBubble'
import { t } from '../../../locales/en'

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
  onTranscriptionEdit?: (newText: string) => void
}

const markdownStyles: Record<string, React.CSSProperties> = {
  p: { margin: '0 0 8px 0' },
  pLast: { margin: 0 },
  ul: { margin: '4px 0', paddingLeft: 20 },
  ol: { margin: '4px 0', paddingLeft: 20 },
  li: { marginBottom: 2 },
  code: {
    background: 'var(--surface-2)',
    padding: '1px 5px',
    borderRadius: 4,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  pre: {
    background: 'var(--surface-2)',
    padding: '8px 12px',
    borderRadius: 6,
    overflow: 'auto',
    fontSize: 13,
    margin: '6px 0',
  },
  h1: { fontSize: 16, fontWeight: 700, margin: '8px 0 4px' },
  h2: { fontSize: 15, fontWeight: 600, margin: '8px 0 4px' },
  h3: { fontSize: 14, fontWeight: 600, margin: '6px 0 2px' },
  blockquote: {
    borderLeft: '3px solid var(--border)',
    paddingLeft: 10,
    margin: '6px 0',
    color: 'var(--text-muted)',
  },
}

export function MessageBubble({ role, content, author, timestamp, showAuthor = false, readStatus, replyTo, pinned, starred, audio, isOwner, onTranscriptionEdit }: MessageBubbleProps) {
  const isUser = role === 'user'
  const isSystem = role === 'system'

  if (isSystem) {
    return (
      <div
        role="article"
        aria-label={`Message from ${author}`}
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
        fontSize: 10,
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
        <span style={{ fontStyle: 'italic', marginRight: 2 }}>{t.audio.edited}</span>
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
      aria-label={`Message from ${author}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          maxWidth: '65%',
          background: isUser ? 'var(--accent-light)' : 'var(--surface)',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          padding: '6px 10px 6px 10px',
          fontSize: 14,
          color: 'var(--text)',
          lineHeight: 1.6,
          border: isUser ? '1px solid var(--accent-border)' : '1px solid var(--border)',
        }}
      >
        {replyTo && <ReplyQuote author={replyTo.author} content={replyTo.content} />}

        {showAuthor && !isUser && (
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>
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
        ) : isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {content}
            {timestampEl}
          </span>
        ) : (
          <div>
            <Markdown
              components={{
                p: ({ children, ...props }) => (
                  <p {...props} style={markdownStyles.p}>{children}</p>
                ),
                ul: ({ children, ...props }) => (
                  <ul {...props} style={markdownStyles.ul}>{children}</ul>
                ),
                ol: ({ children, ...props }) => (
                  <ol {...props} style={markdownStyles.ol}>{children}</ol>
                ),
                li: ({ children, ...props }) => (
                  <li {...props} style={markdownStyles.li}>{children}</li>
                ),
                code: ({ children, className, ...props }) => {
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
                pre: ({ children }) => <>{children}</>,
                h1: ({ children, ...props }) => (
                  <h1 {...props} style={markdownStyles.h1}>{children}</h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 {...props} style={markdownStyles.h2}>{children}</h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 {...props} style={markdownStyles.h3}>{children}</h3>
                ),
                blockquote: ({ children, ...props }) => (
                  <blockquote {...props} style={markdownStyles.blockquote}>{children}</blockquote>
                ),
                a: ({ children, href, ...props }) => (
                  <a {...props} href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                    {children}
                  </a>
                ),
              }}
            >
              {content}
            </Markdown>
            {timestampEl}
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageBubble
