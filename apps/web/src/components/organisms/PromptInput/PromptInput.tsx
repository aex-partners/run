import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Mic, Square, Paperclip, X, Loader2 } from 'lucide-react'
import { Attachment } from '../../molecules/Attachment/Attachment'
import { t } from '../../../locales/en'

export interface PromptInputAttachment {
  id: string
  fileName: string
  fileSize: string
  fileType: string
  thumbnailUrl?: string
}

export interface PromptInputProps {
  value?: string
  onChange?: (value: string) => void
  onSend?: (value: string) => void
  placeholder?: string
  attachments?: PromptInputAttachment[]
  onAttachmentAdd?: (files: FileList) => void
  onAttachmentRemove?: (id: string) => void
  replyTo?: { author: string; content: string } | null
  onCancelReply?: () => void
  micState?: 'idle' | 'recording' | 'processing'
  onMicClick?: () => void
  disabled?: boolean
}

const MAX_TEXTAREA_LINES = 6
const LINE_HEIGHT_PX = 21

const KEYFRAMES = `
@keyframes aex-prompt-mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
}
@keyframes aex-prompt-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`

export function PromptInput({
  value: controlledValue,
  onChange,
  onSend,
  placeholder = 'Message...',
  attachments = [],
  onAttachmentAdd,
  onAttachmentRemove,
  replyTo,
  onCancelReply,
  micState = 'idle',
  onMicClick,
  disabled = false,
}: PromptInputProps) {
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState('')
  const inputValue = isControlled ? controlledValue : internalValue
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const id = 'aex-prompt-input-styles'
    if (!document.getElementById(id)) {
      const style = document.createElement('style')
      style.id = id
      style.textContent = KEYFRAMES
      document.head.appendChild(style)
    }
  }, [])

  const updateValue = useCallback(
    (v: string) => {
      if (!isControlled) setInternalValue(v)
      onChange?.(v)
    },
    [isControlled, onChange],
  )

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || disabled) return
    onSend?.(inputValue.trim())
    updateValue('')
  }, [inputValue, disabled, onSend, updateValue])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0'
    const maxHeight = LINE_HEIGHT_PX * MAX_TEXTAREA_LINES + 16
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [inputValue])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      onAttachmentAdd?.(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAttachmentAdd?.(e.target.files)
    }
    e.target.value = ''
  }

  const hasText = inputValue.trim().length > 0

  return (
    <div
      style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
        position: 'relative',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            background: 'rgba(234, 88, 12, 0.06)',
            border: '2px dashed var(--accent)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: 'var(--accent)',
            fontWeight: 500,
            pointerEvents: 'none',
          }}
        >
          {t.promptInput.dragDrop}
        </div>
      )}

      {/* Single bordered container */}
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${isFocused ? 'var(--accent)' : 'var(--border)'}`,
          background: '#fff',
          overflow: 'hidden',
          opacity: disabled ? 0.6 : 1,
          transition: 'border-color 0.15s',
        }}
      >
        {/* Reply bar (inside container) */}
        {replyTo && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--accent-light)',
            }}
          >
            <div
              style={{
                width: 3,
                alignSelf: 'stretch',
                background: 'var(--accent)',
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{replyTo.author}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {replyTo.content}
              </div>
            </div>
            <button
              onClick={onCancelReply}
              aria-label={t.promptInput.cancelReply}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 2,
                display: 'flex',
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Attachments (inside container) */}
        {attachments.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {attachments.map((att) => (
              <Attachment
                key={att.id}
                fileName={att.fileName}
                fileSize={att.fileSize}
                fileType={att.fileType}
                variant="inline"
                onRemove={() => onAttachmentRemove?.(att.id)}
              />
            ))}
          </div>
        )}

        {/* Textarea area */}
        <div style={{ padding: '12px 16px 0 16px' }}>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => updateValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            aria-label={t.promptInput.messageInput}
            rows={1}
            disabled={disabled}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 14,
              fontFamily: 'inherit',
              lineHeight: '1.5',
              resize: 'none',
              overflowY: 'auto',
              minHeight: 21,
              maxHeight: LINE_HEIGHT_PX * MAX_TEXTAREA_LINES + 16,
              display: 'block',
            }}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          tabIndex={-1}
        />

        {/* Footer: tools left, send/mic right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
          }}
        >
          {/* Left side: attach */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              aria-label={t.promptInput.attachFile}
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              style={{
                background: 'none',
                border: 'none',
                cursor: disabled ? 'default' : 'pointer',
                color: 'var(--text-muted)',
                padding: 4,
                display: 'flex',
                borderRadius: 6,
              }}
            >
              <Paperclip size={18} />
            </button>
          </div>

          {/* Right side: send or mic */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {hasText ? (
              <button
                onClick={handleSend}
                disabled={disabled}
                aria-label={t.promptInput.sendMessage}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  border: 'none',
                  color: '#fff',
                  cursor: disabled ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                }}
              >
                <Send size={15} />
              </button>
            ) : (
              <button
                type="button"
                aria-label={
                  micState === 'recording'
                    ? t.promptInput.stopRecording
                    : micState === 'processing'
                      ? t.promptInput.processingAudio
                      : t.promptInput.voiceMessage
                }
                onClick={onMicClick}
                disabled={disabled || micState === 'processing'}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: micState === 'recording' ? 'var(--danger)' : 'transparent',
                  border: 'none',
                  color: micState === 'recording' ? '#fff' : 'var(--text-muted)',
                  cursor: disabled || micState === 'processing' ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  animation: micState === 'recording' ? 'aex-prompt-mic-pulse 1.5s ease-in-out infinite' : 'none',
                }}
              >
                {micState === 'recording' && <Square size={14} />}
                {micState === 'processing' && <Loader2 size={16} style={{ animation: 'aex-prompt-spin 1s linear infinite' }} />}
                {micState === 'idle' && <Mic size={18} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PromptInput
