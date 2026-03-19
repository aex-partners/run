import { useState } from 'react'
import { Star, Paperclip, Sparkles } from 'lucide-react'
import { Avatar } from '../../atoms/Avatar/Avatar'

export interface MailItemProps {
  id: string
  from: string
  fromEmail: string
  subject: string
  preview: string
  timestamp: string
  read?: boolean
  starred?: boolean
  hasAttachment?: boolean
  labels?: { name: string; color: string }[]
  selected?: boolean
  active?: boolean
  aiSummary?: string
  onClick?: (id: string) => void
  onStar?: (id: string) => void
  onSelect?: (id: string, selected: boolean) => void
}

export function MailItem(props: MailItemProps) {
  const {
    id,
    from,
    subject,
    preview,
    timestamp,
    read = true,
    starred = false,
    hasAttachment = false,
    labels = [],
    selected = false,
    active = false,
    aiSummary,
    onClick,
    onStar,
    onSelect,
  } = props
  const [hovered, setHovered] = useState(false)

  return (
    <div
      role="row"
      aria-selected={active}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        background: active ? 'var(--accent-light)' : selected ? 'var(--surface-2)' : hovered ? 'var(--surface-2)' : 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'background 0.1s',
        borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
      }}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => {
          e.stopPropagation()
          onSelect?.(id, e.target.checked)
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select email from ${from}`}
        style={{ width: 14, height: 14, accentColor: 'var(--accent)', flexShrink: 0, cursor: 'pointer' }}
      />

      {/* Star */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onStar?.(id)
        }}
        aria-label={starred ? 'Unstar' : 'Star'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
      >
        <Star
          size={14}
          fill={starred ? '#f59e0b' : 'none'}
          color={starred ? '#f59e0b' : 'var(--text-muted)'}
        />
      </button>

      {/* Avatar */}
      <div onClick={() => onClick?.(id)} style={{ flexShrink: 0 }}>
        <Avatar name={from} size="sm" />
      </div>

      {/* Content */}
      <div onClick={() => onClick?.(id)} style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* Row 1: sender + labels + timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{
            fontSize: 13,
            fontWeight: read ? 400 : 700,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {from}
          </span>
          {labels.map((label) => (
            <span
              key={label.name}
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 10,
                background: label.color + '20',
                color: label.color,
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {label.name}
            </span>
          ))}
          <div style={{ flex: 1 }} />
          {hasAttachment && <Paperclip size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {timestamp}
          </span>
        </div>

        {/* Row 2: subject */}
        <div style={{
          fontSize: 13,
          fontWeight: read ? 400 : 600,
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: 1,
        }}>
          {subject}
        </div>

        {/* Row 3: preview or AI summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {aiSummary ? (
            <>
              <Sparkles size={10} color="var(--accent)" style={{ flexShrink: 0 }} />
              <span style={{
                fontSize: 12,
                color: 'var(--accent)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontStyle: 'italic',
              }}>
                {aiSummary}
              </span>
            </>
          ) : (
            <span style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {preview}
            </span>
          )}
        </div>

        {/* Unread indicator */}
        {!read && (
          <div style={{
            position: 'absolute',
            left: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--accent)',
          }} />
        )}
      </div>
    </div>
  )
}

export default MailItem
