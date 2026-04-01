import React, { useState, useRef } from 'react'
import {
  X, Paperclip, Sparkles, Minimize2, Maximize2,
} from 'lucide-react'
import { Button } from '../../atoms/Button/Button'
import { useTranslation } from 'react-i18next'

export interface MailAttachmentMeta {
  id: string
  name: string
  size: string
  path: string
  mimeType?: string
}

export interface MailComposeProps {
  open: boolean
  to?: string
  subject?: string
  body?: string
  replyMode?: 'reply' | 'replyAll' | 'forward'
  onClose?: () => void
  onSend?: (data: { to: string; cc: string; subject: string; body: string; attachments?: MailAttachmentMeta[] }) => void
  onAiDraft?: (prompt: string) => void
  aiDrafting?: boolean
  minimized?: boolean
  onToggleMinimize?: () => void
}

export function MailCompose({
  open,
  to: initialTo = '',
  subject: initialSubject = '',
  body: initialBody = '',
  replyMode,
  onClose,
  onSend,
  onAiDraft,
  aiDrafting = false,
  minimized = false,
  onToggleMinimize,
}: MailComposeProps) {
  const { t } = useTranslation()
  const [to, setTo] = useState(initialTo)
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const [showCc, setShowCc] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAiBar, setShowAiBar] = useState(false)
  const [attachments, setAttachments] = useState<MailAttachmentMeta[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setTo(initialTo)
    setSubject(initialSubject)
    setBody(initialBody)
    setAttachments([])
  }, [initialTo, initialSubject, initialBody])

  if (!open) return null

  const handleSend = () => {
    onSend?.({ to, cc, subject, body, attachments: attachments.length > 0 ? attachments : undefined })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload/file', { method: 'POST', body: formData, credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setAttachments((prev) => [...prev, { id: data.id, name: data.name, size: data.size, path: data.path, mimeType: data.mimeType }])
        }
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleAiDraft = () => {
    if (aiPrompt.trim()) {
      onAiDraft?.(aiPrompt)
      setAiPrompt('')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 0',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const prefixMap = {
    reply: 'Re: ',
    replyAll: 'Re: ',
    forward: 'Fwd: ',
  }

  const displaySubject = replyMode && !subject.startsWith(prefixMap[replyMode])
    ? prefixMap[replyMode] + subject
    : subject

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      right: 24,
      width: minimized ? 320 : 560,
      background: 'var(--surface)',
      borderRadius: '12px 12px 0 0',
      border: '1px solid var(--border)',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      zIndex: 150,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Title bar */}
      <div
        onClick={onToggleMinimize}
        style={{
          padding: '10px 14px',
          background: 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
          {replyMode === 'forward' ? 'Forward' : replyMode ? 'Reply' : 'New Message'}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMinimize?.() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-muted)' }}
        >
          {minimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onClose?.() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>

      {!minimized && (
        <>
          {/* Fields */}
          <div style={{ padding: '4px 14px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>{t('mail.to')}</span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={t('mail.recipientPlaceholder')}
                style={inputStyle}
              />
              {!showCc && (
                <button
                  onClick={() => setShowCc(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', padding: '4px 8px', flexShrink: 0 }}
                >
                  Cc
                </button>
              )}
            </div>

            {showCc && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>{t('mail.cc')}</span>
                <input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder={t('mail.ccPlaceholder')}
                  style={inputStyle}
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>{t('mail.subject')}</span>
              <input
                value={displaySubject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('mail.subjectPlaceholder')}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div style={{ padding: '6px 14px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {attachments.map((att) => (
                <div
                  key={att.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    fontSize: 11,
                    color: 'var(--text)',
                  }}
                >
                  <Paperclip size={11} color="var(--text-muted)" />
                  <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({att.size})</span>
                  <button
                    onClick={() => handleRemoveAttachment(att.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, display: 'flex', color: 'var(--text-muted)' }}
                    aria-label={t('remove')}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('mail.writePlaceholder')}
            style={{
              flex: 1,
              minHeight: 180,
              padding: '12px 14px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'none',
              lineHeight: 1.6,
            }}
          />

          {/* AI bar */}
          {showAiBar && (
            <div style={{
              padding: '8px 14px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--accent-light)',
            }}>
              <Sparkles size={14} color="var(--accent)" />
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={t('mail.aiDraftPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleAiDraft()}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <Button variant="primary" size="sm" onClick={handleAiDraft} loading={aiDrafting}>Draft</Button>
            </div>
          )}

          {/* Bottom bar */}
          <div style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}>
            <Button variant="primary" size="sm" onClick={handleSend}>{t('mail.send')}</Button>
            <button
              onClick={() => setShowAiBar(!showAiBar)}
              title={t('mail.aiDraft')}
              style={{
                background: showAiBar ? 'var(--accent-light)' : 'none',
                border: showAiBar ? '1px solid var(--accent)' : '1px solid transparent',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 6,
                display: 'flex',
                color: showAiBar ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              <Sparkles size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title={t('mail.attachFile')}
              style={{
                background: 'none',
                border: 'none',
                cursor: uploading ? 'wait' : 'pointer',
                padding: 6,
                display: 'flex',
                color: 'var(--text-muted)',
                opacity: uploading ? 0.5 : 1,
              }}
            >
              <Paperclip size={14} />
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={onClose}
              title={t('mail.discard')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default MailCompose
