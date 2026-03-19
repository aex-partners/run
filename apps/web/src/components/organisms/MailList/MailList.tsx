import React from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { MailItem, type MailItemProps } from '../../molecules/MailItem/MailItem'
import { Archive, Trash2, MailOpen, MailX, Tag, RefreshCw } from 'lucide-react'

export interface MailListProps {
  emails: Omit<MailItemProps, 'onClick' | 'onStar' | 'onSelect'>[]
  activeEmailId?: string
  selectedIds?: Set<string>
  onEmailClick?: (id: string) => void
  onEmailStar?: (id: string) => void
  onEmailSelect?: (id: string, selected: boolean) => void
  onSelectAll?: (selected: boolean) => void
  onArchive?: () => void
  onDelete?: () => void
  onMarkRead?: () => void
  onMarkUnread?: () => void
  onRefresh?: () => void
  loading?: boolean
}

export function MailList({
  emails,
  activeEmailId,
  selectedIds = new Set(),
  onEmailClick,
  onEmailStar,
  onEmailSelect,
  onSelectAll,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onRefresh,
  loading = false,
}: MailListProps) {
  const hasSelection = selectedIds.size > 0
  const allSelected = emails.length > 0 && selectedIds.size === emails.length

  const toolbarButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    color: 'var(--text-muted)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => onSelectAll?.(e.target.checked)}
          aria-label="Select all"
          style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer', marginRight: 8 }}
        />

        {hasSelection ? (
          <>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 8 }}>
              {selectedIds.size} selected
            </span>
            <button onClick={onArchive} title="Archive" style={toolbarButtonStyle}>
              <Archive size={14} />
            </button>
            <button onClick={onDelete} title="Delete" style={toolbarButtonStyle}>
              <Trash2 size={14} />
            </button>
            <button onClick={onMarkRead} title="Mark as read" style={toolbarButtonStyle}>
              <MailOpen size={14} />
            </button>
            <button onClick={onMarkUnread} title="Mark as unread" style={toolbarButtonStyle}>
              <MailX size={14} />
            </button>
            <button title="Label" style={toolbarButtonStyle}>
              <Tag size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onRefresh}
              title="Refresh"
              style={{
                ...toolbarButtonStyle,
                animation: loading ? 'spin 1s linear infinite' : undefined,
              }}
            >
              <RefreshCw size={14} />
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {emails.length} emails
            </span>
          </>
        )}
      </div>

      {/* Email list */}
      <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport style={{ height: '100%' }}>
          {emails.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No emails in this folder.
            </div>
          ) : (
            emails.map((email) => (
              <MailItem
                key={email.id}
                {...email}
                active={email.id === activeEmailId}
                selected={selectedIds.has(email.id)}
                onClick={onEmailClick}
                onStar={onEmailStar}
                onSelect={onEmailSelect}
              />
            ))
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" style={{ width: 6 }}>
          <ScrollArea.Thumb style={{ background: 'var(--border)', borderRadius: 3 }} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  )
}

export default MailList
