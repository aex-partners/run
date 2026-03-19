import React from 'react'
import { Check, CheckCheck } from 'lucide-react'

export interface ReadReceiptProps {
  status: 'sent' | 'delivered' | 'read'
}

export function ReadReceipt({ status }: ReadReceiptProps) {
  if (status === 'sent') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-label="Sent">
        <Check size={14} color="var(--text-muted)" />
      </span>
    )
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-label={status === 'read' ? 'Read' : 'Delivered'}>
      <CheckCheck size={14} color={status === 'read' ? '#53bdeb' : 'var(--text-muted)'} />
    </span>
  )
}

export default ReadReceipt
