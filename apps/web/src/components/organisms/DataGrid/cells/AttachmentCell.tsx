import { Paperclip } from 'lucide-react'
import type { CellProps } from '../types'

export function AttachmentCell({ value }: CellProps) {
  const displayValue = String(value)
  const isEmpty = !displayValue || displayValue === 'undefined'

  if (isEmpty) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        color: 'var(--text-muted)',
        cursor: 'pointer',
      }}>
        <Paperclip size={12} />
        Attach
      </span>
    )
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 13,
      color: 'var(--text)',
    }}>
      <Paperclip size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
      {displayValue}
    </span>
  )
}
