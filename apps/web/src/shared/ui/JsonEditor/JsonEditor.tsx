import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Textarea } from '../Textarea/Textarea'

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
  const { t } = useTranslation()
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
      setError(err instanceof SyntaxError ? err.message : t('jsonEditor.invalidJson'))
    }
  }

  return (
    <Textarea
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      monospace
      rows={rows}
      error={error}
      aria-label={ariaLabel}
    />
  )
}

export default JsonEditor
