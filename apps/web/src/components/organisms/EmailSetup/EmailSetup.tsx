import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '../../atoms/Input/Input'
import { Button } from '../../atoms/Button/Button'

export interface SmtpConfig {
  host: string
  port: string
  user: string
  pass: string
  from: string
  secure: boolean
}

export interface EmailSetupProps {
  onSmtpSubmit?: (config: SmtpConfig) => void
}

export function EmailSetup({ onSmtpSubmit }: EmailSetupProps) {
  const { t } = useTranslation()
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
  )
}

export default EmailSetup
