import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Inbox, Send, FileText, AlertTriangle, Trash2, Star, Tag,
  Search, PenSquare, Plus, Menu, Sparkles, Mail,
} from 'lucide-react'
import { MailFolderItem } from '../../molecules/MailFolderItem/MailFolderItem'
import { MailList } from '../../organisms/MailList/MailList'
import { MailDetail, type MailMessage } from '../../organisms/MailDetail/MailDetail'
import { MailCompose } from '../../organisms/MailCompose/MailCompose'
import { EmailSetup } from '../../organisms/EmailSetup/EmailSetup'
import { Button } from '../../atoms/Button/Button'
import type { MailItemProps } from '../../molecules/MailItem/MailItem'

export type MailFolder = 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | 'starred'

export interface MailLabel {
  id: string
  name: string
  color: string
  count?: number
}

export interface MailEmail extends Omit<MailItemProps, 'onClick' | 'onStar' | 'onSelect' | 'active' | 'selected'> {
  folder: MailFolder
  thread?: MailMessage[]
  aiSummary?: string
  aiDraft?: string
}

export interface MailScreenProps {
  emails: MailEmail[]
  labels?: MailLabel[]
  activeFolder?: MailFolder
  activeEmailId?: string
  folderCounts?: Partial<Record<MailFolder, number>>
  hasAccount?: boolean
  connectedEmail?: string
  onConnectOAuth?: (provider: 'gmail' | 'outlook') => Promise<void> | void
  onSmtpSubmit?: (config: { host: string; port: string; user: string; pass: string; from: string; secure: boolean }) => void
  onFolderChange?: (folder: MailFolder) => void
  onEmailClick?: (id: string) => void
  onEmailStar?: (id: string) => void
  onCompose?: () => void
  onSend?: (data: { to: string; cc: string; subject: string; body: string }) => void
  onReply?: (emailId: string) => void
  onReplyAll?: (emailId: string) => void
  onForward?: (emailId: string) => void
  onArchive?: (ids: string[]) => void
  onDelete?: (ids: string[]) => void
  onMarkRead?: (ids: string[]) => void
  onMarkUnread?: (ids: string[]) => void
  onRefresh?: () => void
  onAiAction?: (prompt: string) => void
  onAiDraft?: (prompt: string) => void
  aiDrafting?: boolean
  loading?: boolean
}

const FOLDERS: { id: MailFolder; labelKey: string; icon: React.ReactNode }[] = [
  { id: 'inbox', labelKey: 'mail.inbox', icon: <Inbox size={16} /> },
  { id: 'starred', labelKey: 'mail.starred', icon: <Star size={16} /> },
  { id: 'sent', labelKey: 'mail.sent', icon: <Send size={16} /> },
  { id: 'drafts', labelKey: 'mail.drafts', icon: <FileText size={16} /> },
  { id: 'spam', labelKey: 'mail.spam', icon: <AlertTriangle size={16} /> },
  { id: 'trash', labelKey: 'mail.trash', icon: <Trash2 size={16} /> },
]

const SIDEBAR_EXPANDED = 220
const SIDEBAR_COLLAPSED = 56

export function MailScreen({
  emails,
  labels = [],
  activeFolder: controlledFolder,
  activeEmailId: controlledEmailId,
  folderCounts = {},
  hasAccount = true,
  connectedEmail,
  onConnectOAuth,
  onSmtpSubmit,
  onFolderChange,
  onEmailClick,
  onEmailStar,
  onCompose,
  onSend,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onRefresh,
  onAiAction,
  onAiDraft,
  aiDrafting = false,
  loading = false,
}: MailScreenProps) {
  const { t } = useTranslation()
  const [internalFolder, setInternalFolder] = useState<MailFolder>('inbox')
  const [internalEmailId, setInternalEmailId] = useState<string | undefined>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeMinimized, setComposeMinimized] = useState(false)
  const [composeData, setComposeData] = useState<{ to: string; subject: string; body: string; mode?: 'reply' | 'replyAll' | 'forward' }>({ to: '', subject: '', body: '' })

  const activeFolder = controlledFolder ?? internalFolder
  const activeEmailId = controlledEmailId ?? internalEmailId
  const showingDetail = !!activeEmailId

  const handleFolderChange = (folder: MailFolder) => {
    setInternalFolder(folder)
    setInternalEmailId(undefined)
    setSelectedIds(new Set())
    onFolderChange?.(folder)
  }

  const handleEmailClick = (id: string) => {
    setInternalEmailId(id)
    onEmailClick?.(id)
  }

  const handleBack = () => {
    setInternalEmailId(undefined)
  }

  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(filteredEmails.map((e) => e.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleCompose = () => {
    setComposeData({ to: '', subject: '', body: '' })
    setComposeOpen(true)
    setComposeMinimized(false)
    onCompose?.()
  }

  const handleReply = () => {
    if (!activeEmail) return
    setComposeData({
      to: activeEmail.fromEmail,
      subject: activeEmail.subject,
      body: '',
      mode: 'reply',
    })
    setComposeOpen(true)
    setComposeMinimized(false)
    onReply?.(activeEmail.id)
  }

  const handleReplyAll = () => {
    if (!activeEmail) return
    setComposeData({
      to: activeEmail.fromEmail,
      subject: activeEmail.subject,
      body: '',
      mode: 'replyAll',
    })
    setComposeOpen(true)
    setComposeMinimized(false)
    onReplyAll?.(activeEmail.id)
  }

  const handleForward = () => {
    if (!activeEmail) return
    setComposeData({
      to: '',
      subject: activeEmail.subject,
      body: '',
      mode: 'forward',
    })
    setComposeOpen(true)
    setComposeMinimized(false)
    onForward?.(activeEmail.id)
  }

  // Filter emails by folder and search
  const filteredEmails = emails.filter((e) => {
    if (activeFolder === 'starred') return e.starred
    if (e.folder !== activeFolder) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        e.from.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        e.preview.toLowerCase().includes(q)
      )
    }
    return true
  })

  const activeEmail = emails.find((e) => e.id === activeEmailId)
  const activeEmailIndex = activeEmail ? filteredEmails.findIndex((e) => e.id === activeEmail.id) : -1

  if (!hasAccount) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: 40,
      }}>
        <div style={{
          maxWidth: 640,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'var(--accent-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Mail size={32} color="var(--accent)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
              {t('mail.setup.title')}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              {t('mail.setup.subtitle')}
            </p>
          </div>
          <EmailSetup
            onConnectOAuth={onConnectOAuth}
            connectedEmail={connectedEmail}
            onSmtpSubmit={onSmtpSubmit}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar - collapsible */}
      <aside style={{
        width: sidebarExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED,
        minWidth: sidebarExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s, min-width 0.2s',
        overflow: 'hidden',
      }}>
        {/* Hamburger + Compose */}
        <div style={{
          padding: sidebarExpanded ? '10px 12px' : '10px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            aria-label={sidebarExpanded ? t('collapseSidebar') : t('expandSidebar')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <Menu size={18} />
          </button>
          {sidebarExpanded && (
            <Button
              variant="primary"
              onClick={handleCompose}
              leftIcon={<PenSquare size={14} />}
            >
              {t('mail.compose')}
            </Button>
          )}
        </div>

        {/* Collapsed compose button */}
        {!sidebarExpanded && (
          <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={handleCompose}
              aria-label={t('mail.compose')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 16,
                background: 'var(--accent)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}
            >
              <PenSquare size={18} />
            </button>
          </div>
        )}

        {/* Folders */}
        <div style={{ padding: '4px 0' }}>
          {FOLDERS.map((folder) => (
            sidebarExpanded ? (
              <MailFolderItem
                key={folder.id}
                icon={folder.icon}
                label={t(folder.labelKey)}
                count={folderCounts[folder.id]}
                active={activeFolder === folder.id}
                onClick={() => handleFolderChange(folder.id)}
              />
            ) : (
              <button
                key={folder.id}
                onClick={() => handleFolderChange(folder.id)}
                title={t(folder.labelKey)}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: activeFolder === folder.id ? 'var(--accent-light)' : 'transparent',
                  border: 'none',
                  borderLeft: activeFolder === folder.id ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  color: activeFolder === folder.id ? 'var(--accent)' : 'var(--text-muted)',
                  position: 'relative',
                }}
              >
                {folder.icon}
                {folderCounts[folder.id] && folderCounts[folder.id]! > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: 4,
                    right: 8,
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--accent)',
                  }}>
                    {folderCounts[folder.id]}
                  </span>
                )}
              </button>
            )
          ))}
        </div>

        {/* Labels - only when expanded */}
        {sidebarExpanded && labels.length > 0 && (
          <>
            <div style={{
              padding: '16px 14px 6px',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              {t('mail.labels')}
              <button style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex',
                color: 'var(--text-muted)',
              }}>
                <Plus size={12} />
              </button>
            </div>
            {labels.map((label) => (
              <MailFolderItem
                key={label.id}
                icon={<Tag size={14} fill={label.color} color={label.color} />}
                label={label.name}
                count={label.count}
                onClick={() => {}}
              />
            ))}
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* AI bar at bottom - only when expanded */}
        {sidebarExpanded && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Sparkles size={12} color="var(--accent)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{t('aiAssistant')}</span>
            </div>
            <input
              placeholder={t('mail.aiPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  onAiAction?.(e.currentTarget.value)
                  e.currentTarget.value = ''
                }
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 12,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}
      </aside>

      {/* Main area - switches between list and detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Search bar - always visible */}
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('mail.searchPlaceholder')}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 12, color: 'var(--text-muted)' }}
            >
              {t('clear')}
            </button>
          )}
        </div>

        {/* Content: list or detail */}
        {showingDetail && activeEmail ? (
          <MailDetail
            subject={activeEmail.subject}
            starred={activeEmail.starred}
            labels={activeEmail.labels}
            messages={activeEmail.thread ?? [{
              id: '1',
              from: activeEmail.from,
              fromEmail: activeEmail.fromEmail,
              to: ['me'],
              date: activeEmail.timestamp,
              content: activeEmail.preview,
            }]}
            aiSummary={activeEmail.aiSummary}
            aiDraft={activeEmail.aiDraft}
            onBack={handleBack}
            emailPosition={activeEmailIndex >= 0 ? `${activeEmailIndex + 1} of ${filteredEmails.length}` : undefined}
            onReply={handleReply}
            onReplyAll={handleReplyAll}
            onForward={handleForward}
            onArchive={() => onArchive?.([activeEmail.id])}
            onDelete={() => onDelete?.([activeEmail.id])}
            onStar={() => onEmailStar?.(activeEmail.id)}
          />
        ) : (
          <MailList
            emails={filteredEmails}
            activeEmailId={activeEmailId}
            selectedIds={selectedIds}
            onEmailClick={handleEmailClick}
            onEmailStar={onEmailStar}
            onEmailSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onArchive={() => onArchive?.([...selectedIds])}
            onDelete={() => onDelete?.([...selectedIds])}
            onMarkRead={() => onMarkRead?.([...selectedIds])}
            onMarkUnread={() => onMarkUnread?.([...selectedIds])}
            onRefresh={onRefresh}
            loading={loading}
          />
        )}
      </div>

      {/* Compose overlay - floats over everything */}
      <MailCompose
        open={composeOpen}
        to={composeData.to}
        subject={composeData.subject}
        body={composeData.body}
        replyMode={composeData.mode}
        onClose={() => setComposeOpen(false)}
        onSend={(data) => {
          onSend?.(data)
          setComposeOpen(false)
        }}
        onAiDraft={onAiDraft}
        aiDrafting={aiDrafting}
        minimized={composeMinimized}
        onToggleMinimize={() => setComposeMinimized(!composeMinimized)}
      />
    </div>
  )
}

export default MailScreen
