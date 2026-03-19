import React from 'react'

export interface ReplyQuoteProps {
  author: string
  content: string
}

export function ReplyQuote({ author, content }: ReplyQuoteProps) {
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: 6,
        padding: '4px 8px',
        marginBottom: 4,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--accent)',
          marginBottom: 1,
        }}
      >
        {author}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {content}
      </div>
    </div>
  )
}

export default ReplyQuote
