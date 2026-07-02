import React from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { MailItem, type MailItemProps } from '../MailItem/MailItem'
import { Archive, Trash2, MailOpen, MailX, Tag, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
  onLabel?: () => void
  onRefresh?: () => void
  loading?: boolean
}

export function MailList({
  emails,
  activeEmailId,
  selectedIds: externalSelectedIds = new Set(),
  onEmailClick,
  onEmailStar,
  onEmailSelect,
  onSelectAll,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onLabel,
  onRefresh,
  loading = false,
}: MailListProps) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  React.useEffect(() => {
    setSelectedIds(externalSelectedIds)
  }, [externalSelectedIds])
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
          aria-label={t('mail.selectAll')}
          style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer', marginRight: 8 }}
        />

        {hasSelection ? (
          <>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 8 }}>
              {t('mail.selected', { count: selectedIds.size })}
            </span>
            <button onClick={onArchive} title={t('mail.archive')} style={toolbarButtonStyle}>
              <Archive size={14} />
            </button>
            <button onClick={onDelete} title={t('delete')} style={toolbarButtonStyle}>
              <Trash2 size={14} />
            </button>
            <button onClick={onMarkRead} title={t('mail.markRead')} style={toolbarButtonStyle}>
              <MailOpen size={14} />
            </button>
            <button onClick={onMarkUnread} title={t('mail.markUnread')} style={toolbarButtonStyle}>
              <MailX size={14} />
            </button>
            <button onClick={onLabel} title={t('mail.label')} style={toolbarButtonStyle}>
              <Tag size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onRefresh}
              title={t('refresh')}
              style={{
                ...toolbarButtonStyle,
                animation: loading ? 'spin 1s linear infinite' : undefined,
              }}
            >
              <RefreshCw size={14} />
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t('mail.emailCount', { count: emails.length })}
            </span>
          </>
        )}
      </div>

      {/* Email list */}
      <ScrollArea.Root type="always" style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport style={{ height: '100%' }}>
          {emails.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {t('mail.noEmails')}
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
        <ScrollArea.Scrollbar
          orientation="vertical"
          style={{ width: 12, padding: '2px', background: 'var(--surface-2)', display: 'flex' }}
        >
          <ScrollArea.Thumb style={{ flex: 1, background: 'var(--text-muted)', opacity: 0.4, borderRadius: 4 }} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  )
}

export default MailList
