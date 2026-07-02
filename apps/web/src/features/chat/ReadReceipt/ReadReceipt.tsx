import { Check, CheckCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface ReadReceiptProps {
  status: 'sent' | 'delivered' | 'read'
}

export function ReadReceipt({ status }: ReadReceiptProps) {
  const { t } = useTranslation()

  if (status === 'sent') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-label={t('readReceipt.sent')}>
        <Check size={14} color="var(--text-muted)" />
      </span>
    )
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-label={status === 'read' ? t('readReceipt.read') : t('readReceipt.delivered')}>
      <CheckCheck size={14} color={status === 'read' ? '#53bdeb' : 'var(--text-muted)'} />
    </span>
  )
}

export default ReadReceipt
