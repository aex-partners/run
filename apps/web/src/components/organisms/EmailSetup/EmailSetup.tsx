import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OnboardingPathCard } from '../../molecules/OnboardingPathCard/OnboardingPathCard'
import { Input } from '../../atoms/Input/Input'
import { Button } from '../../atoms/Button/Button'

export type EmailProvider = 'gmail' | 'outlook' | 'smtp' | null

export interface SmtpConfig {
  host: string
  port: string
  user: string
  pass: string
  from: string
  secure: boolean
}

export interface EmailSetupProps {
  onConnectOAuth?: (provider: 'gmail' | 'outlook') => Promise<void> | void
  connectedEmail?: string
  onSmtpSubmit?: (config: SmtpConfig) => void
}

export function EmailSetup({ onConnectOAuth, connectedEmail, onSmtpSubmit }: EmailSetupProps) {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<EmailProvider>(null)
  const [connecting, setConnecting] = useState(false)
  const [showSmtpPass, setShowSmtpPass] = useState(false)
  const [smtp, setSmtp] = useState<SmtpConfig>({
    host: '',
    port: '587',
    user: '',
    pass: '',
    from: '',
    secure: true,
  })

  const updateSmtp = <K extends keyof SmtpConfig>(key: K, value: SmtpConfig[K]) => {
    setSmtp((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <OnboardingPathCard
          title={t('setup.email.gmail.title')}
          description={t('setup.email.gmail.description')}
          icon="Mail"
          selected={provider === 'gmail'}
          onClick={() => setProvider(provider === 'gmail' ? null : 'gmail')}
        />
        <OnboardingPathCard
          title={t('setup.email.outlook.title')}
          description={t('setup.email.outlook.description')}
          icon="Mail"
          selected={provider === 'outlook'}
          onClick={() => setProvider(provider === 'outlook' ? null : 'outlook')}
        />
        <OnboardingPathCard
          title={t('setup.email.smtp.title')}
          description={t('setup.email.smtp.description')}
          icon="Server"
          selected={provider === 'smtp'}
          onClick={() => setProvider(provider === 'smtp' ? null : 'smtp')}
        />
      </div>

      {(provider === 'gmail' || provider === 'outlook') && (
        <div style={{
          padding: 20,
          background: 'var(--accent-light)',
          borderRadius: 10,
          border: '1px solid var(--accent)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          {connectedEmail ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                {t('setup.email.connected')} <strong>{connectedEmail}</strong>
              </span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, margin: 0 }}>
                {t('setup.email.oauthNote')}
              </p>
              <Button
                variant="primary"
                loading={connecting}
                onClick={async () => {
                  if (!onConnectOAuth) return
                  setConnecting(true)
                  try {
                    await onConnectOAuth(provider)
                  } finally {
                    setConnecting(false)
                  }
                }}
              >
                {connecting
                  ? t('setup.email.connecting')
                  : t('setup.email.connectButton', { provider: provider === 'gmail' ? 'Gmail' : 'Outlook' })}
              </Button>
            </>
          )}
        </div>
      )}

      {provider === 'smtp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                {t('setup.smtp.host')}
              </label>
              <Input
                placeholder={t('setup.smtp.hostPlaceholder')}
                value={smtp.host}
                onChange={(e) => updateSmtp('host', e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                {t('setup.smtp.port')}
              </label>
              <Input
                placeholder="587"
                value={smtp.port}
                onChange={(e) => updateSmtp('port', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t('setup.smtp.user')}
            </label>
            <Input
              placeholder={t('setup.smtp.userPlaceholder')}
              value={smtp.user}
              onChange={(e) => updateSmtp('user', e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t('setup.smtp.pass')}
            </label>
            <Input
              placeholder={t('setup.smtp.passPlaceholder')}
              value={smtp.pass}
              onChange={(e) => updateSmtp('pass', e.target.value)}
              type={showSmtpPass ? 'text' : 'password'}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowSmtpPass(!showSmtpPass)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
                >
                  {showSmtpPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t('setup.smtp.from')}
            </label>
            <Input
              placeholder={t('setup.smtp.fromPlaceholder')}
              value={smtp.from}
              onChange={(e) => updateSmtp('from', e.target.value)}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={smtp.secure}
              onChange={(e) => updateSmtp('secure', e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            {t('setup.smtp.secure')}
          </label>
          {onSmtpSubmit && (
            <Button
              variant="primary"
              onClick={() => onSmtpSubmit(smtp)}
              disabled={!smtp.host || !smtp.user || !smtp.pass || !smtp.from}
            >
              {t('mail.setup.connect')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default EmailSetup
