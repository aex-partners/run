import { useState } from 'react'
import { Globe, Copy, Check } from 'lucide-react'
import { t } from '../../../locales/en'

interface FormSharePanelProps {
  isPublic: boolean
  publicToken?: string | null
  submissionCount: number
  onTogglePublic: () => void
}

export function FormSharePanel({
  isPublic,
  publicToken,
  submissionCount,
  onTogglePublic,
}: FormSharePanelProps) {
  const [copied, setCopied] = useState(false)

  const publicUrl = publicToken
    ? `${window.location.origin}/f/${publicToken}`
    : ''

  const handleCopy = () => {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      padding: '16px 20px',
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Globe size={14} color="var(--text-muted)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {t.database.forms.share.title}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>
          {t.database.forms.share.publicAccess}
        </span>
        <button
          onClick={onTogglePublic}
          style={{
            width: 40,
            height: 22,
            borderRadius: 11,
            border: 'none',
            background: isPublic ? 'var(--accent)' : 'var(--border)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
          }}
        >
          <div style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: 3,
            left: isPublic ? 21 : 3,
            transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {isPublic && publicToken && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--surface-2)',
          borderRadius: 6,
          padding: '6px 10px',
          border: '1px solid var(--border)',
          marginBottom: 12,
        }}>
          <input
            readOnly
            value={publicUrl}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleCopy}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              padding: 2,
              color: copied ? '#16a34a' : 'var(--text-muted)',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}

      {!isPublic && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t.database.forms.share.enablePublic}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        {t.database.forms.share.submissions}: {submissionCount}
      </div>
    </div>
  )
}
