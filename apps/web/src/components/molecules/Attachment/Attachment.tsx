import React from 'react'
import { FileText, FileImage, FileSpreadsheet, FileCode, File, X } from 'lucide-react'

export interface AttachmentProps {
  fileName: string
  fileSize: string
  fileType: string
  thumbnailUrl?: string
  variant: 'grid' | 'inline'
  onRemove?: () => void
}

function getFileIcon(fileType: string) {
  const type = fileType.toLowerCase()
  if (type.startsWith('image')) return <FileImage size={20} />
  if (type.includes('spreadsheet') || type.includes('csv') || type.includes('excel')) return <FileSpreadsheet size={20} />
  if (type.includes('code') || type.includes('javascript') || type.includes('json') || type.includes('typescript')) return <FileCode size={20} />
  if (type.includes('text') || type.includes('pdf') || type.includes('document')) return <FileText size={20} />
  return <File size={20} />
}

function getSmallIcon(fileType: string) {
  const type = fileType.toLowerCase()
  if (type.startsWith('image')) return <FileImage size={14} />
  if (type.includes('spreadsheet') || type.includes('csv') || type.includes('excel')) return <FileSpreadsheet size={14} />
  if (type.includes('code') || type.includes('javascript') || type.includes('json') || type.includes('typescript')) return <FileCode size={14} />
  if (type.includes('text') || type.includes('pdf') || type.includes('document')) return <FileText size={14} />
  return <File size={14} />
}

export function Attachment({ fileName, fileSize, fileType, thumbnailUrl, variant, onRemove }: AttachmentProps) {
  if (variant === 'inline') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          fontSize: 12,
          color: 'var(--text)',
          maxWidth: 200,
        }}
      >
        <span style={{ display: 'flex', color: 'var(--text-muted)', flexShrink: 0 }}>
          {getSmallIcon(fileType)}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${fileName}`}
            style={{
              display: 'flex',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 0,
              flexShrink: 0,
            }}
          >
            <X size={12} />
          </button>
        )}
      </span>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 10,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        maxWidth: 240,
        position: 'relative',
      }}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={fileName}
          style={{
            width: 40,
            height: 40,
            borderRadius: 6,
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 6,
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          {getFileIcon(fileType)}
        </div>
      )}

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {fileSize}
        </div>
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${fileName}`}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'flex',
            background: 'var(--surface-2)',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 2,
            borderRadius: '50%',
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

export default Attachment
