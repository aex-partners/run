import { useEffect, useState } from 'react'
import {
  Download, Share2, Trash2, Star, ExternalLink,
  FileText, FileSpreadsheet, Image, File, ArrowLeft,
  Sparkles, Mail, MessageSquare, Zap, Upload, Brain,
  Pencil, FolderInput, Loader2,
} from 'lucide-react'
import { Button } from '../../../shared/ui/Button/Button'
import type { FileSource } from '../FileItem/FileItem'
import { useTranslation } from 'react-i18next'
import { apiUrl } from '../../../platform/api'

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']
const TEXT_EXTS = ['txt', 'csv', 'json', 'xml', 'md', 'log']

type PreviewKind = 'image' | 'pdf' | 'text' | 'none'

function previewKind(type: string): PreviewKind {
  const ext = type.toLowerCase()
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (TEXT_EXTS.includes(ext)) return 'text'
  return 'none'
}

export interface FilePreviewProps {
  id: string
  name: string
  type: string
  size: string
  modifiedAt: string
  modifiedBy?: string
  source: FileSource
  sourceRef?: string
  starred?: boolean
  previewUrl?: string
  aiSummary?: string
  aiIndexed?: boolean
  isFolder?: boolean
  onClose?: () => void
  onDownload?: () => void
  onShare?: () => void
  onDelete?: () => void
  onStar?: () => void
  onRename?: () => void
  onMove?: () => void
  onOpenSource?: () => void
  onToggleAiIndex?: (enabled: boolean) => void
}

const SOURCE_ICONS: Record<FileSource, React.ReactNode> = {
  email: <Mail size={12} />,
  chat: <MessageSquare size={12} />,
  generated: <Sparkles size={12} />,
  upload: <Upload size={12} />,
  workflow: <Zap size={12} />,
}

const SOURCE_LABEL_KEYS: Record<FileSource, string> = {
  email: 'files.sourceEmail',
  chat: 'files.sourceChat',
  generated: 'files.sourceGenerated',
  upload: 'files.sourceUpload',
  workflow: 'files.sourceWorkflow',
}

function getPreviewIcon(type: string) {
  const ext = type.toLowerCase()
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return <FileText size={48} color="var(--text-muted)" />
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={48} color="#059669" />
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return <Image size={48} color="#7c3aed" />
  return <File size={48} color="var(--text-muted)" />
}

export function FilePreview({
  id,
  name,
  type,
  size,
  modifiedAt,
  modifiedBy,
  source,
  sourceRef,
  starred = false,
  previewUrl,
  aiSummary,
  aiIndexed = false,
  isFolder = false,
  onClose,
  onDownload,
  onShare,
  onDelete,
  onStar,
  onRename,
  onMove,
  onOpenSource,
  onToggleAiIndex,
}: FilePreviewProps) {
  const { t } = useTranslation()

  // Inline preview via authenticated blob fetch (works cross-origin in dev,
  // where a Lax session cookie would not ride an <img>/<iframe> subresource GET).
  const kind = isFolder ? 'none' : previewKind(type)
  // Fall back to the canonical raw endpoint if the backend did not supply previewUrl.
  const rawUrl = previewUrl ?? (isFolder ? null : `/api/files/${id}/raw`)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (kind === 'none' || !rawUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBlobUrl(null)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewError(false)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewLoading(false)
      return
    }
    const controller = new AbortController()
    let objectUrl: string | null = null
    setPreviewLoading(true)
    setPreviewError(false)
    setBlobUrl(null)
    fetch(apiUrl(rawUrl), { credentials: 'include', signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Preview failed: ${res.status}`)
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setPreviewError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviewLoading(false)
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [rawUrl, kind])

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
        <button onClick={onClose} title={t('back')} style={iconBtnStyle}>
          <ArrowLeft size={18} />
        </button>
        {!isFolder && (
          <button onClick={onDownload} title={t('download')} style={iconBtnStyle}><Download size={16} /></button>
        )}
        <button onClick={onShare} title={t('share')} style={iconBtnStyle}><Share2 size={16} /></button>
        <button onClick={onRename} title={t('files.rename')} style={iconBtnStyle}><Pencil size={16} /></button>
        <button onClick={onMove} title={t('files.moveTo')} style={iconBtnStyle}><FolderInput size={16} /></button>
        <button onClick={onDelete} title={t('delete')} style={iconBtnStyle}><Trash2 size={16} /></button>
        <button onClick={onStar} title={starred ? t('files.unstar') : t('files.star')} style={iconBtnStyle}>
          <Star size={16} fill={starred ? '#f59e0b' : 'none'} color={starred ? '#f59e0b' : 'var(--text-muted)'} />
        </button>
        <div style={{ flex: 1 }} />
        {!isFolder && (
          <button onClick={() => window.open(apiUrl(rawUrl ?? `/api/files/${id}/raw`), '_blank')} title={t('files.openInNewTab')} style={iconBtnStyle}>
            <ExternalLink size={16} />
          </button>
        )}
      </div>

      {/* Preview area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6',
        overflow: 'hidden',
      }}>
        {kind !== 'none' && !previewError ? (
          previewLoading || !blobUrl ? (
            <Loader2 size={28} color="var(--text-muted)" className="animate-spin" />
          ) : kind === 'image' ? (
            <img
              src={blobUrl}
              alt={name}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          ) : (
            // pdf + text render inline in an iframe from the blob URL
            <iframe
              src={blobUrl}
              title={name}
              style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
            />
          )
        ) : (
          <div style={{ textAlign: 'center' }}>
            {getPreviewIcon(type)}
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, marginBottom: 12 }}>
              {t('files.previewNotAvailable')}
            </p>
            {!isFolder && (
              <Button variant="secondary" size="sm" leftIcon={<Download size={13} />} onClick={onDownload}>
                {t('files.downloadToView')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* File details panel */}
      <div style={{
        padding: 16,
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
        overflowY: 'auto',
        maxHeight: 280,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 10px', wordBreak: 'break-word' }}>
          {name}
        </h3>

        {/* AI Summary */}
        {aiSummary && (
          <div style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--accent-light)',
            border: '1px solid var(--accent-border, #fed7aa)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            marginBottom: 10,
          }}>
            <Sparkles size={12} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{aiSummary}</span>
          </div>
        )}

        {/* AI Indexing toggle */}
        <div style={{
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: aiIndexed ? 'var(--accent-light)' : 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}>
          <Brain size={14} color={aiIndexed ? 'var(--accent)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: aiIndexed ? 'var(--accent)' : 'var(--text)' }}>
              {t('files.aiIndexing')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {isFolder
                ? (aiIndexed ? t('files.aiIndexedFolderOn') : t('files.aiIndexedFolderOff'))
                : (aiIndexed ? t('files.aiIndexedOn') : t('files.aiIndexedOff'))
              }
            </div>
          </div>
          <button
            onClick={() => onToggleAiIndex?.(!aiIndexed)}
            role="switch"
            aria-checked={aiIndexed}
            style={{
              width: 36, height: 20, borderRadius: 10, padding: 2,
              background: aiIndexed ? 'var(--accent)' : 'var(--border)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff',
              transform: aiIndexed ? 'translateX(16px)' : 'translateX(0)',
              transition: 'transform 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <DetailRow label={t('type')} value={isFolder ? t('files.folder') : type.toUpperCase()} />
          {!isFolder && <DetailRow label={t('files.size')} value={size} />}
          <DetailRow label={t('files.modified')} value={modifiedAt} />
          {modifiedBy && <DetailRow label={t('files.by')} value={modifiedBy} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)', width: 70, flexShrink: 0 }}>{t('files.source')}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text)' }}>
              {SOURCE_ICONS[source]} {t(SOURCE_LABEL_KEYS[source])}
            </span>
          </div>
          {sourceRef && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 70, flexShrink: 0 }} />
              <button
                onClick={onOpenSource}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: 'var(--accent)', fontSize: 12, fontFamily: 'inherit', textDecoration: 'underline',
                }}
              >
                {sourceRef}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)', width: 70, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

export default FilePreview
