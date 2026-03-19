import React from 'react'
import { Upload } from 'lucide-react'

export interface FileUploadProps {
  value?: string
  onChange?: (file: File | null) => void
  accept?: string
  disabled?: boolean
  hint?: string
}

export function FileUpload({
  value,
  onChange,
  accept = 'image/png,image/jpeg',
  disabled = false,
  hint,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file) {
      onChange?.(file)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload file"
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          border: '2px dashed var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          overflow: 'hidden',
          background: 'var(--surface)',
          transition: 'border-color 0.15s',
        }}
      >
        {value ? (
          <img
            src={value}
            alt="Upload preview"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Upload size={24} style={{ color: 'var(--text-muted)' }} />
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        style={{ display: 'none' }}
        aria-hidden
      />
      {hint && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          {hint}
        </span>
      )}
    </div>
  )
}

export default FileUpload
