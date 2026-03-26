import { useMemo } from 'react'
import { Mail, Shield, Send, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface EmailPreviewPanelProps {
  provider: 'smtp' | null
}

export function EmailPreviewPanel({ provider }: EmailPreviewPanelProps) {
  const { t } = useTranslation()

  const smtpFeatures = useMemo(() => [
    { icon: <Send size={16} />, label: t('setup.showcase.email.smtpSend') },
    { icon: <Shield size={16} />, label: t('setup.showcase.email.tlsEncryption') },
    { icon: <Server size={16} />, label: t('setup.showcase.email.anyProvider') },
  ], [t])

  return (
    <div
      data-testid="email-preview-panel"
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
      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #9a3412)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mail size={32} color="#fff" />
        </div>

        {!provider ? (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('setup.showcase.email.title')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('setup.showcase.email.description')}</div>
          </div>
        ) : (
          <>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>SMTP</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('setup.showcase.email.smtpDesc')}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
              {smtpFeatures.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                    {f.icon}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', textAlign: 'left' }}>{f.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default EmailPreviewPanel
