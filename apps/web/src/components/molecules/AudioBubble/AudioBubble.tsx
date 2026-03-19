import React, { useState } from 'react'
import { FileText, ChevronDown, ChevronUp, Pencil, Check, X } from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { AudioPlayer } from '../../atoms/AudioPlayer/AudioPlayer'
import { t } from '../../../locales/en'

export interface AudioBubbleProps {
  url: string
  duration: string
  waveform?: number[]
  transcription?: string
  transcriptionEdited?: boolean
  isOwner: boolean
  onTranscriptionEdit?: (newText: string) => void
}

export function AudioBubble({
  url,
  duration,
  waveform,
  transcription,
  transcriptionEdited,
  isOwner,
  onTranscriptionEdit,
}: AudioBubbleProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(transcription ?? '')

  const handleSave = () => {
    onTranscriptionEdit?.(editText)
    setEditing(false)
  }

  const handleCancel = () => {
    setEditText(transcription ?? '')
    setEditing(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AudioPlayer url={url} duration={duration} waveform={waveform} />

      {transcription && (
        <Collapsible.Root open={open} onOpenChange={setOpen}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Collapsible.Trigger asChild>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  fontFamily: 'inherit',
                  padding: 0,
                }}
              >
                <FileText size={13} />
                <span>{t.audio.transcription}</span>
                {transcriptionEdited && (
                  <span style={{ fontStyle: 'italic', fontSize: 11 }}>{t.audio.edited}</span>
                )}
                {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </Collapsible.Trigger>

            {isOwner && !editing && open && (
              <button
                onClick={() => { setEditText(transcription); setEditing(true) }}
                aria-label={t.audio.editTranscription}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 2,
                  display: 'flex',
                }}
              >
                <Pencil size={12} />
              </button>
            )}
          </div>

          <Collapsible.Content>
            <div style={{ marginTop: 4 }}>
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: 60,
                      padding: '6px 8px',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    <button
                      onClick={handleSave}
                      aria-label={t.audio.saveEdit}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: 'var(--accent)',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={handleCancel}
                      aria-label={t.audio.cancelEdit}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {transcription}
                </div>
              )}
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      )}
    </div>
  )
}

export default AudioBubble
