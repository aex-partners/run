import React, { useState, useRef, useEffect } from 'react'
import {
  X, Paperclip, Sparkles, Minimize2, Maximize2,
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Quote, Link2,
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '../../../shared/ui/Button/Button'
import { useTranslation } from 'react-i18next'

// Convert a value that may be plaintext (AI drafts) or already HTML (replies/forwards)
// into HTML safe for Tiptap's setContent. Detects markup; otherwise escapes and
// turns blank-line groups into paragraphs and single newlines into <br>.
function bodyToHtml(s: string): string {
  if (!s) return ''
  if (/<[a-z!/][\s\S]*>/i.test(s)) return s
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function ToolbarButton({ active, onClick, title, children }: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--accent-light)' : 'none',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
      }}
    >
      {children}
    </button>
  )
}

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
  cc?: string
  subject?: string
  body?: string
  replyMode?: 'reply' | 'replyAll' | 'forward'
  onClose?: () => void
  onSend?: (data: { to: string; cc: string; subject: string; body: string; attachments?: MailAttachmentMeta[] }) => void
  onAiDraft?: (prompt: string) => void
  aiDrafting?: boolean
  aiEnabled?: boolean
  minimized?: boolean
  onToggleMinimize?: () => void
}

export function MailCompose({
  open,
  to: initialTo = '',
  cc: initialCc = '',
  subject: initialSubject = '',
  body: initialBody = '',
  replyMode,
  onClose,
  onSend,
  onAiDraft,
  aiDrafting = false,
  aiEnabled = true,
  minimized = false,
  onToggleMinimize,
}: MailComposeProps) {
  const { t } = useTranslation()
  const [to, setTo] = useState(initialTo)
  const [cc, setCc] = useState(initialCc)
  const [subject, setSubject] = useState(initialSubject)
  const [showCc, setShowCc] = useState(!!initialCc)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAiBar, setShowAiBar] = useState(false)
  const [attachments, setAttachments] = useState<MailAttachmentMeta[]>([])
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: t('mail.writePlaceholder') }),
    ],
    content: bodyToHtml(initialBody),
    editorProps: {
      attributes: { class: 'aex-rte-content' },
    },
  })

  React.useEffect(() => {
    setTo(initialTo)
    setCc(initialCc)
    setSubject(initialSubject)
    setShowCc(!!initialCc)
    setAiPrompt('')
    setShowAiBar(false)
  }, [initialTo, initialCc, initialSubject, initialBody])

  // Tiptap is uncontrolled: prefill/reset must go through setContent, not state.
  React.useEffect(() => {
    if (!editor) return
    const html = bodyToHtml(initialBody)
    if (editor.getHTML() !== html) {
      editor.commands.setContent(html, { emitUpdate: false })
    }
  }, [editor, initialBody])

  // Reset attachments only when opening
  React.useEffect(() => {
    if (open) {
      setAttachments([])
    }
  }, [open])

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort()
    }
  }, [])

  const prefixMap = {
    reply: 'Re: ',
    replyAll: 'Re: ',
    forward: 'Fwd: ',
  }

  const displaySubject = replyMode && !subject.startsWith(prefixMap[replyMode])
    ? prefixMap[replyMode] + subject
    : subject

  if (!open) return null

  const handleSend = async () => {
    setSending(true)
    try {
      const body = editor && !editor.isEmpty ? editor.getHTML() : ''
      await onSend?.({ to, cc, subject: displaySubject, body, attachments: attachments.length > 0 ? attachments : undefined })
    } finally {
      setSending(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    const controller = new AbortController()
    uploadAbortRef.current = controller
    try {
      for (const file of Array.from(files)) {
        if (controller.signal.aborted) break
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload/file', { method: 'POST', body: formData, credentials: 'include', signal: controller.signal })
        if (res.ok) {
          const data = await res.json()
          setAttachments((prev) => [...prev, { id: data.id, name: data.name, size: data.size, path: data.path, mimeType: data.mimeType }])
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        // ignore abort errors
      }
    } finally {
      setUploading(false)
      uploadAbortRef.current = null
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

  const handleSetLink = () => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt(t('mail.linkPrompt'), prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-muted)',
    minWidth: 64,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    marginRight: 8,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 0',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      right: 24,
      width: minimized ? 320 : 600,
      maxHeight: minimized ? undefined : 'calc(100vh - 24px)',
      background: 'var(--surface)',
      borderRadius: '12px 12px 0 0',
      border: '1px solid var(--border)',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      zIndex: 150,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{`
        .aex-rte-content { outline: none; min-height: 200px; padding: 14px 16px; font-size: 14px; line-height: 1.6; color: var(--text); }
        .aex-rte-content p { margin: 0 0 8px; }
        .aex-rte-content p:last-child { margin-bottom: 0; }
        .aex-rte-content ul, .aex-rte-content ol { margin: 0 0 8px; padding-left: 22px; }
        .aex-rte-content a { color: var(--accent); text-decoration: underline; }
        .aex-rte-content blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid var(--border); color: var(--text-muted); }
        .aex-rte-content p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--text-muted); float: left; height: 0; pointer-events: none; }
      `}</style>
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
          {replyMode === 'forward' ? t('mail.forward') : replyMode ? t('mail.reply') : t('mail.newMessage')}
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
              <span style={labelStyle}>{t('mail.to')}</span>
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
                  {t('mail.cc')}
                </button>
              )}
            </div>

            {showCc && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={labelStyle}>{t('mail.cc')}</span>
                <input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder={t('mail.ccPlaceholder')}
                  style={inputStyle}
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={labelStyle}>{t('mail.subject')}</span>
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

          {/* Formatting toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '6px 12px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <ToolbarButton active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} title={t('mail.bold')}><Bold size={14} /></ToolbarButton>
            <ToolbarButton active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()} title={t('mail.italic')}><Italic size={14} /></ToolbarButton>
            <ToolbarButton active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()} title={t('mail.underline')}><UnderlineIcon size={14} /></ToolbarButton>
            <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
            <ToolbarButton active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()} title={t('mail.bulletList')}><List size={14} /></ToolbarButton>
            <ToolbarButton active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()} title={t('mail.orderedList')}><ListOrdered size={14} /></ToolbarButton>
            <ToolbarButton active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()} title={t('mail.quote')}><Quote size={14} /></ToolbarButton>
            <ToolbarButton active={editor?.isActive('link')} onClick={handleSetLink} title={t('mail.link')}><Link2 size={14} /></ToolbarButton>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 180 }}>
            <EditorContent editor={editor} />
          </div>

          {/* AI bar */}
          {aiEnabled && showAiBar && (
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
              <Button variant="primary" size="sm" onClick={handleAiDraft} loading={aiDrafting}>{t('mail.draftAction')}</Button>
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
            <Button variant="primary" size="sm" onClick={handleSend} disabled={sending} loading={sending}>{t('mail.send')}</Button>
            {aiEnabled && (
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
            )}
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
