import React, { useEffect, useState } from 'react'
import { Calendar, DollarSign, Clock, Hash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { COUNTRIES } from '../../../../data/locale-options'

export interface LocalePreviewPanelProps {
  country?: string
  language?: string
  timezone?: string
}

function PreviewRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}

export function LocalePreviewPanel({ country, language, timezone }: LocalePreviewPanelProps) {
  const { t } = useTranslation()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const countryData = COUNTRIES.find((c) => c.value === country) as { value: string; label: string; dateFormat?: string; currencyCode?: string; currencySymbol?: string } | undefined

  const dateStr = countryData?.dateFormat === 'DD/MM/YYYY'
    ? `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
    : `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`

  const currencyCode = countryData?.currencyCode || 'USD'
  const currencyStr = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(1234.56)

  const timeStr = timezone
    ? now.toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const sampleStr = `${countryData?.currencySymbol || '$'}1,234.56`

  const hasData = country || language || timezone

  return (
    <div
      data-testid="locale-preview-panel"
      style={{
        flex: 1,
        background: 'var(--accent-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        minHeight: 0,
      }}
    >
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{t('setup.showcase.locale.title')}</div>
        </div>
        {hasData ? (
          <>
            <PreviewRow icon={<Calendar size={16} />} label={t('setup.showcase.locale.dateLabel')} value={dateStr} />
            <PreviewRow icon={<DollarSign size={16} />} label={t('setup.showcase.locale.currencyLabel')} value={currencyStr} />
            <PreviewRow icon={<Clock size={16} />} label={t('setup.showcase.locale.timeLabel')} value={timeStr} />
            <PreviewRow icon={<Hash size={16} />} label={t('setup.showcase.locale.sampleAmount')} value={sampleStr} />
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
            Select your regional preferences to see a format preview.
          </div>
        )}
      </div>
    </div>
  )
}

export default LocalePreviewPanel
