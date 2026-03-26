import React, { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, ChevronDown, ChevronUp, Check, Loader2, X, Search, Server, Globe, Wifi, RefreshCw } from 'lucide-react'
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

export interface EmailAccountConfig {
  email: string
  password: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpSecure: boolean
  imapHost: string
  imapPort: number
  imapUser: string
  imapPass: string
  imapSecure: boolean
}

export type DiscoverStep =
  | 'idle'
  | 'checking_known_providers'
  | 'checking_autoconfig'
  | 'checking_mx_records'
  | 'trying_common_patterns'
  | 'testing_connection'
  | 'verifying_smtp'
  | 'verifying_imap'
  | 'syncing'
  | 'done'
  | 'failed'

export interface EmailSetupProps {
  onSmtpSubmit?: (config: SmtpConfig) => void
  onAccountSubmit?: (config: EmailAccountConfig) => void
  onDiscover?: (email: string) => Promise<{
    smtpHost: string
    smtpPort: number
    smtpSecure: boolean
    imapHost: string
    imapPort: number
    imapSecure: boolean
  } | null>
  onVerifySmtp?: (config: {
    host: string
    port: number
    user: string
    pass: string
    from: string
    secure: boolean
  }) => Promise<{ ok: boolean; error?: string }>
  onVerifyImap?: (config: {
    host: string
    port: number
    user: string
    pass: string
    secure: boolean
  }) => Promise<{ ok: boolean; error?: string }>
  discovering?: boolean
  discoverStep?: DiscoverStep
}

const STEP_LABELS: Record<DiscoverStep, { en: string; pt: string }> = {
  idle: { en: '', pt: '' },
  checking_known_providers: { en: 'Checking known providers...', pt: 'Verificando provedores conhecidos...' },
  checking_autoconfig: { en: 'Looking up autoconfig...', pt: 'Buscando autoconfig...' },
  checking_mx_records: { en: 'Resolving MX records...', pt: 'Resolvendo registros MX...' },
  trying_common_patterns: { en: 'Testing common server patterns...', pt: 'Testando padr\u00f5es comuns...' },
  testing_connection: { en: 'Testing connection...', pt: 'Testando conex\u00e3o...' },
  verifying_smtp: { en: 'Verifying SMTP credentials...', pt: 'Verificando credenciais SMTP...' },
  verifying_imap: { en: 'Verifying IMAP credentials...', pt: 'Verificando credenciais IMAP...' },
  syncing: { en: 'Downloading emails...', pt: 'Baixando emails...' },
  done: { en: 'Connected!', pt: 'Conectado!' },
  failed: { en: 'Could not auto-detect settings', pt: 'N\u00e3o foi poss\u00edvel detectar automaticamente' },
}

const STEP_ORDER: DiscoverStep[] = [
  'checking_known_providers',
  'checking_autoconfig',
  'checking_mx_records',
  'trying_common_patterns',
  'verifying_smtp',
  'verifying_imap',
  'syncing',
  'done',
]

const STEP_ICONS: Record<string, React.ReactNode> = {
  checking_known_providers: <Search size={14} />,
  checking_autoconfig: <Globe size={14} />,
  checking_mx_records: <Server size={14} />,
  trying_common_patterns: <Wifi size={14} />,
  verifying_smtp: <Mail size={14} />,
  verifying_imap: <RefreshCw size={14} />,
  syncing: <RefreshCw size={14} />,
  done: <Check size={14} />,
}

export function EmailSetup({
  onSmtpSubmit,
  onAccountSubmit,
  onDiscover,
  onVerifySmtp,
  onVerifyImap,
  discovering: externalDiscovering,
  discoverStep: externalStep,
}: EmailSetupProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('pt') ? 'pt' : 'en'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Discovery state
  const [discovering, setDiscovering] = useState(false)
  const [currentStep, setCurrentStep] = useState<DiscoverStep>('idle')
  const [completedSteps, setCompletedSteps] = useState<DiscoverStep[]>([])
  const [discoveredSettings, setDiscoveredSettings] = useState<{
    smtpHost: string; smtpPort: number; smtpSecure: boolean
    imapHost: string; imapPort: number; imapSecure: boolean
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Manual mode
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual] = useState({
    smtpHost: '', smtpPort: '587', smtpSecure: true,
    imapHost: '', imapPort: '993', imapSecure: true,
  })

  const activeStep = externalStep ?? currentStep
  const isDiscovering = externalDiscovering ?? discovering

  const updateManual = <K extends keyof typeof manual>(key: K, value: (typeof manual)[K]) => {
    setManual((prev) => ({ ...prev, [key]: value }))
  }

  const progressPercent = (() => {
    const idx = STEP_ORDER.indexOf(activeStep)
    if (idx === -1) return 0
    return Math.round(((idx + 1) / STEP_ORDER.length) * 100)
  })()

  const markStep = (step: DiscoverStep) => {
    setCurrentStep(step)
    setCompletedSteps((prev) => {
      const idx = STEP_ORDER.indexOf(step)
      return STEP_ORDER.slice(0, idx)
    })
  }

  const handleAutoDiscover = async () => {
    if (!email || !password) return
    setDiscovering(true)
    setError(null)
    setCompletedSteps([])
    setDiscoveredSettings(null)
    setShowManual(false)

    try {
      // Step 1: Autodiscover server settings
      markStep('checking_known_providers')

      let settings: typeof discoveredSettings = null

      if (onDiscover) {
        // Simulate step progression while waiting for API
        const stepTimer = setInterval(() => {
          setCurrentStep((prev) => {
            const idx = STEP_ORDER.indexOf(prev)
            if (idx >= 0 && idx < 3) {
              const next = STEP_ORDER[idx + 1]
              setCompletedSteps((p) => [...p, prev])
              return next
            }
            return prev
          })
        }, 800)

        settings = await onDiscover(email)
        clearInterval(stepTimer)
      }

      if (!settings) {
        markStep('failed')
        setError(STEP_LABELS.failed[lang])
        setShowManual(true)
        setDiscovering(false)
        return
      }

      setDiscoveredSettings(settings)

      // Step 2: Verify SMTP
      markStep('verifying_smtp')
      if (onVerifySmtp) {
        const smtpResult = await onVerifySmtp({
          host: settings.smtpHost,
          port: settings.smtpPort,
          user: email,
          pass: password,
          from: email,
          secure: settings.smtpSecure,
        })
        if (!smtpResult.ok) {
          setError(`SMTP: ${smtpResult.error}`)
          setShowManual(true)
          setDiscovering(false)
          markStep('failed')
          // Pre-fill manual form with discovered settings
          setManual({
            smtpHost: settings.smtpHost,
            smtpPort: String(settings.smtpPort),
            smtpSecure: settings.smtpSecure,
            imapHost: settings.imapHost,
            imapPort: String(settings.imapPort),
            imapSecure: settings.imapSecure,
          })
          return
        }
      }
      setCompletedSteps((prev) => [...prev, 'verifying_smtp'])

      // Step 3: Verify IMAP
      markStep('verifying_imap')
      if (onVerifyImap) {
        const imapResult = await onVerifyImap({
          host: settings.imapHost,
          port: settings.imapPort,
          user: email,
          pass: password,
          secure: settings.imapSecure,
        })
        if (!imapResult.ok) {
          setError(`IMAP: ${imapResult.error}`)
          setShowManual(true)
          setDiscovering(false)
          markStep('failed')
          setManual({
            smtpHost: settings.smtpHost,
            smtpPort: String(settings.smtpPort),
            smtpSecure: settings.smtpSecure,
            imapHost: settings.imapHost,
            imapPort: String(settings.imapPort),
            imapSecure: settings.imapSecure,
          })
          return
        }
      }
      setCompletedSteps((prev) => [...prev, 'verifying_imap'])

      // Step 4: Submit account
      markStep('syncing')
      if (onAccountSubmit) {
        onAccountSubmit({
          email,
          password,
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpUser: email,
          smtpPass: password,
          smtpSecure: settings.smtpSecure,
          imapHost: settings.imapHost,
          imapPort: settings.imapPort,
          imapUser: email,
          imapPass: password,
          imapSecure: settings.imapSecure,
        })
      }

      setCompletedSteps((prev) => [...prev, 'syncing'])
      markStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      markStep('failed')
      setShowManual(true)
    } finally {
      setDiscovering(false)
    }
  }

  const handleManualSubmit = () => {
    if (onAccountSubmit) {
      onAccountSubmit({
        email,
        password,
        smtpHost: manual.smtpHost,
        smtpPort: parseInt(manual.smtpPort, 10),
        smtpUser: email,
        smtpPass: password,
        smtpSecure: manual.smtpSecure,
        imapHost: manual.imapHost,
        imapPort: parseInt(manual.imapPort, 10),
        imapUser: email,
        imapPass: password,
        imapSecure: manual.imapSecure,
      })
    } else if (onSmtpSubmit) {
      onSmtpSubmit({
        host: manual.smtpHost,
        port: manual.smtpPort,
        user: email,
        pass: password,
        from: email,
        secure: manual.smtpSecure,
      })
    }
  }

  const canSubmitManual = manual.smtpHost && manual.imapHost && email && password

  // Simple email + password form
  if (activeStep === 'idle' || activeStep === 'failed') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Email */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
            {t('mail.setup.email', 'Email')}
          </label>
          <Input
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            leftIcon={<Mail size={14} style={{ color: 'var(--text-muted)' }} />}
          />
        </div>

        {/* Password */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
            {t('mail.setup.password', 'Password')}
          </label>
          <Input
            placeholder={t('mail.setup.passwordPlaceholder', 'App password or email password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? 'text' : 'password'}
            leftIcon={<Lock size={14} style={{ color: 'var(--text-muted)' }} />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            }
          />
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '10px 12px', borderRadius: 8,
            background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
            fontSize: 13, lineHeight: '1.4',
          }}>
            <X size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Connect button */}
        <Button
          variant="primary"
          onClick={handleAutoDiscover}
          disabled={!email || !password || isDiscovering}
        >
          {isDiscovering ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={14} className="animate-spin" />
              {t('mail.setup.discovering', 'Detecting settings...')}
            </span>
          ) : (
            t('mail.setup.connect', 'Connect')
          )}
        </Button>

        {/* Manual config toggle */}
        {showManual && (
          <ManualConfig
            manual={manual}
            updateManual={updateManual}
            onSubmit={handleManualSubmit}
            canSubmit={!!canSubmitManual}
            t={t}
          />
        )}

        {/* "Configure manually" link for users who know they need it */}
        {!showManual && activeStep === 'idle' && (
          <button
            type="button"
            onClick={() => setShowManual(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--text-muted)', textDecoration: 'underline',
              padding: 0, textAlign: 'center',
            }}
          >
            {t('mail.setup.configureManually', 'Configure manually')}
          </button>
        )}
      </div>
    )
  }

  // Progress view during discovery
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Account info */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 8,
        background: 'var(--bg-secondary, #f9fafb)',
      }}>
        <Mail size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, color: 'var(--text)' }}>{email}</span>
      </div>

      {/* Progress bar */}
      <div style={{ position: 'relative', height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${progressPercent}%`,
            background: activeStep === 'done' ? '#22c55e' : 'var(--accent, #EA580C)',
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Step list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {STEP_ORDER.filter((s) => s !== 'done').map((step) => {
          const isCompleted = completedSteps.includes(step)
          const isCurrent = activeStep === step
          const isPending = !isCompleted && !isCurrent

          return (
            <div
              key={step}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 0',
                opacity: isPending ? 0.4 : 1,
                transition: 'opacity 0.3s',
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isCompleted ? '#dcfce7' : isCurrent ? '#fff5f0' : '#f3f4f6',
                color: isCompleted ? '#16a34a' : isCurrent ? 'var(--accent, #EA580C)' : '#9ca3af',
                transition: 'all 0.3s',
              }}>
                {isCompleted ? <Check size={12} /> : isCurrent ? <Loader2 size={12} className="animate-spin" /> : STEP_ICONS[step]}
              </div>
              <span style={{
                fontSize: 13,
                color: isCompleted ? '#16a34a' : isCurrent ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: isCurrent ? 500 : 400,
              }}>
                {STEP_LABELS[step][lang]}
              </span>
            </div>
          )
        })}

        {/* Done state */}
        {activeStep === 'done' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 8,
            background: '#dcfce7', color: '#166534',
            fontSize: 13, fontWeight: 500,
          }}>
            <Check size={16} />
            {STEP_LABELS.done[lang]}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Manual configuration sub-component
// ---------------------------------------------------------------------------

function ManualConfig({
  manual,
  updateManual,
  onSubmit,
  canSubmit,
  t,
}: {
  manual: { smtpHost: string; smtpPort: string; smtpSecure: boolean; imapHost: string; imapPort: string; imapSecure: boolean }
  updateManual: <K extends keyof typeof manual>(key: K, value: (typeof manual)[K]) => void
  onSubmit: () => void
  canSubmit: boolean
  t: (key: string, fallback?: string) => string
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden',
      marginTop: 4,
    }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', background: '#f9fafb', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, color: 'var(--text)',
        }}
      >
        {t('mail.setup.manualConfig', 'Manual Configuration')}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* SMTP section */}
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            SMTP ({t('mail.setup.outgoing', 'Outgoing')})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>
            <Input
              placeholder={t('setup.smtp.hostPlaceholder', 'smtp.gmail.com')}
              value={manual.smtpHost}
              onChange={(e) => updateManual('smtpHost', e.target.value)}
            />
            <Input
              placeholder="587"
              value={manual.smtpPort}
              onChange={(e) => updateManual('smtpPort', e.target.value)}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={manual.smtpSecure}
              onChange={(e) => updateManual('smtpSecure', e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            TLS/SSL
          </label>

          {/* IMAP section */}
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
            IMAP ({t('mail.setup.incoming', 'Incoming')})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>
            <Input
              placeholder="imap.gmail.com"
              value={manual.imapHost}
              onChange={(e) => updateManual('imapHost', e.target.value)}
            />
            <Input
              placeholder="993"
              value={manual.imapPort}
              onChange={(e) => updateManual('imapPort', e.target.value)}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={manual.imapSecure}
              onChange={(e) => updateManual('imapSecure', e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            TLS/SSL
          </label>

          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={!canSubmit}
            style={{ marginTop: 4 }}
          >
            {t('mail.setup.connect', 'Connect')}
          </Button>
        </div>
      )}
    </div>
  )
}

export default EmailSetup
