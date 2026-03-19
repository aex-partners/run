import React, { useState } from 'react'
import { Textarea } from '../../atoms/Textarea/Textarea'

export interface JsonEditorProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
  'aria-label'?: string
}

export function JsonEditor({
  value = '',
  onChange,
  placeholder = '{}',
  disabled = false,
  rows = 6,
  'aria-label': ariaLabel,
}: JsonEditorProps) {
  const [error, setError] = useState<string | undefined>()

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e.target.value)
    if (error) setError(undefined)
  }

  const handleBlur = () => {
    if (!value.trim()) {
      setError(undefined)
      return
    }
    try {
      JSON.parse(value)
      setError(undefined)
    } catch (err) {
      setError(err instanceof SyntaxError ? err.message : 'Invalid JSON')
    }
  }

  return (
    <div onBlur={handleBlur}>
      <Textarea
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        monospace
        rows={rows}
        error={error}
        aria-label={ariaLabel}
      />
    </div>
  )
}

export default JsonEditor
