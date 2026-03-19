import React from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { CheckCircle2, Loader2, Circle, AlertCircle, ChevronRight, FileText, FileImage, FileSpreadsheet, FileCode, File } from 'lucide-react'

export interface InlineTaskFile {
  name: string
  type: string
}

export interface InlineTaskProps {
  title: string
  status: 'pending' | 'in-progress' | 'completed' | 'error'
  progress?: { current: number; total: number }
  files?: InlineTaskFile[]
  defaultOpen?: boolean
}

const inlineTaskSpinKeyframes = `
@keyframes aex-inline-task-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`

function injectInlineTaskStyles() {
  if (typeof document === 'undefined') return
  const id = 'aex-inline-task-spin'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = inlineTaskSpinKeyframes
    document.head.appendChild(style)
  }
}

function StatusIcon({ status }: { status: InlineTaskProps['status'] }) {
  injectInlineTaskStyles()
  if (status === 'completed') return <CheckCircle2 size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
  if (status === 'in-progress') return <Loader2 size={14} style={{ color: 'var(--accent)', flexShrink: 0, animation: 'aex-inline-task-spin 1s linear infinite' }} />
  if (status === 'error') return <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
  return <Circle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
}

function getFileIcon(type: string) {
  const t = type.toLowerCase()
  if (t.startsWith('image')) return <FileImage size={13} style={{ color: '#2563eb' }} />
  if (t.includes('spreadsheet') || t.includes('csv') || t.includes('excel')) return <FileSpreadsheet size={13} style={{ color: 'var(--success)' }} />
  if (t.includes('code') || t.includes('javascript') || t.includes('json') || t.includes('typescript')) return <FileCode size={13} style={{ color: 'var(--warning)' }} />
  if (t.includes('text') || t.includes('pdf') || t.includes('document')) return <FileText size={13} style={{ color: 'var(--danger)' }} />
  return <File size={13} style={{ color: 'var(--text-muted)' }} />
}

export function InlineTask({ title, status, progress, files, defaultOpen = false }: InlineTaskProps) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        maxWidth: 420,
        overflow: 'hidden',
      }}
    >
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger asChild>
          <button
            type="button"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <StatusIcon status={status} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4 }}>
              {title}
            </span>
            {progress && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                {progress.current}/{progress.total}
              </span>
            )}
            <ChevronRight
              size={12}
              style={{
                color: 'var(--text-muted)',
                transition: 'transform 0.15s',
                transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                flexShrink: 0,
              }}
            />
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content>
          {files && files.length > 0 && (
            <div style={{ padding: '0 12px 10px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8 }}>
                {files.map((file) => (
                  <div key={file.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getFileIcon(file.type)}
                    <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{file.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  )
}

export default InlineTask
