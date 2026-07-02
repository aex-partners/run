import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Key, Globe, User, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '../../../shared/ui/Button/Button'
import { Input } from '../../../shared/ui/Input/Input'

// One field of a piece's auth schema (mirrors the API's PieceAuthProp), driving the
// dynamic Connect form: text -> text input, secret -> password, file -> file picker
// (read to base64), select -> dropdown.
export interface PluginConnectAuthProp {
  name: string
  displayName: string
  type: 'text' | 'secret' | 'file' | 'select'
  required: boolean
  options?: { label: string; value: string }[]
}

export interface PluginConnectDialogProps {
  open: boolean
  onClose: () => void
  pluginName: string
  pluginDisplayName: string
  pluginLogoUrl?: string
  authType: 'oauth2' | 'secret_text' | 'basic_auth' | 'custom_auth' | 'none'
  /** Dynamic auth field-schema for the piece; when non-empty a dynamic form is rendered. */
  authProps?: PluginConnectAuthProp[]
  /** Whether a credential already exists for this plugin */
  connected: boolean
  /** Callback for secret_text / basic_auth / custom_auth credential creation */
  onSaveCredential: (value: Record<string, unknown>) => void
  /** Callback for OAuth2: request auth URL, then open popup */
  onStartOAuth2: (clientId: string, clientSecret: string) => Promise<string>
  /** Callback to disconnect (delete credential) */
  onDisconnect: () => void
  saving?: boolean
}

// Read a File as a base64 string (without the data-URL prefix), the encoding the
// tools expect for file credentials (e.g. the NF-e .pfx bytes).
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('file read failed'))
    reader.readAsDataURL(file)
  })
}

export function PluginConnectDialog({
  open,
  onClose,
  pluginName: _pluginName,
  pluginDisplayName,
  pluginLogoUrl,
  authType,
  authProps = [],
  connected,
  onSaveCredential,
  onStartOAuth2,
  onDisconnect,
  saving = false,
}: PluginConnectDialogProps) {
  const { t } = useTranslation()
  // Form state
  const [apiKey, setApiKey] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [oauthClientId, setOauthClientId] = useState('')
  const [oauthClientSecret, setOauthClientSecret] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [oauthPopup, setOauthPopup] = useState<Window | null>(null)
  const oauthPopupRef = useRef<Window | null>(null)
  // Dynamic form: values keyed by prop name; file props also track a display label.
  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>({})
  const [fileNames, setFileNames] = useState<Record<string, string>>({})

  // A piece with a declared field-schema drives the dynamic multi-field form.
  const isDynamic = authProps.length > 0

  // Keep ref in sync with state so the effect always sees the latest popup
  useEffect(() => {
    oauthPopupRef.current = oauthPopup
  }, [oauthPopup])

  // Manage OAuth2 popup lifecycle: listeners, interval, cleanup
  useEffect(() => {
    if (!connecting || !oauthPopup) return

    const popup = oauthPopup

    let expectedOrigin: string
    try {
      expectedOrigin = new URL(import.meta.env.VITE_API_URL || window.location.origin).origin
    } catch {
      expectedOrigin = window.location.origin
    }

    const handler = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin) return
      if (event.data?.type === 'plugin-oauth-complete') {
        setConnecting(false)
        setOauthPopup(null)
        onClose()
      } else if (event.data?.type === 'plugin-oauth-error') {
        setConnecting(false)
        setOauthPopup(null)
        setError(event.data.error || t('pluginConnect.oauth2Failed'))
      }
    }
    window.addEventListener('message', handler)

    const intervalId = setInterval(() => {
      if (popup.closed) {
        clearInterval(intervalId)
        window.removeEventListener('message', handler)
        setConnecting(false)
        setOauthPopup(null)
      }
    }, 1000)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('message', handler)
    }
  }, [connecting, oauthPopup, onClose, t])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on dialog open
      setApiKey('')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsername('')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPassword('')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOauthClientId('')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOauthClientSecret('')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConnecting(false)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDynamicValues({})
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFileNames({})
    }
  }, [open])

  const handleSaveSecretText = () => {
    if (!apiKey.trim()) {
      setError(t('pluginConnect.apiKeyRequired'))
      return
    }
    onSaveCredential({ type: 'SECRET_TEXT', secret_text: apiKey })
  }

  // Save the dynamic multi-field form: validate required props, then send the values
  // keyed by prop name so the bag matches what the tools resolve (e.g. Sicredi's
  // chaveAcesso/codigoAcesso/beneficiario/cooperativa/agencia/codigoBeneficiario, or
  // PagSeguro's token, or the NF-e pfx+password).
  const handleSaveDynamic = () => {
    for (const prop of authProps) {
      if (prop.required && !(dynamicValues[prop.name] ?? '').trim()) {
        setError(t('pluginConnect.fieldRequired', { field: prop.displayName }))
        return
      }
    }
    onSaveCredential({ type: 'CUSTOM_AUTH', ...dynamicValues })
  }

  const handleFileChange = async (prop: PluginConnectAuthProp, file: File | null) => {
    setError('')
    if (!file) {
      setDynamicValues((v) => ({ ...v, [prop.name]: '' }))
      setFileNames((f) => ({ ...f, [prop.name]: '' }))
      return
    }
    try {
      const base64 = await fileToBase64(file)
      setDynamicValues((v) => ({ ...v, [prop.name]: base64 }))
      setFileNames((f) => ({ ...f, [prop.name]: file.name }))
    } catch {
      setError(t('pluginConnect.oauth2Failed'))
    }
  }

  const handleSaveBasicAuth = () => {
    if (!username.trim() || !password.trim()) {
      setError(t('pluginConnect.usernamePasswordRequired'))
      return
    }
    onSaveCredential({ type: 'BASIC_AUTH', username, password })
  }

  const handleOAuth2Connect = async () => {
    if (!oauthClientId.trim() || !oauthClientSecret.trim()) {
      setError(t('pluginConnect.clientIdSecretRequired'))
      return
    }
    setConnecting(true)
    setError('')
    try {
      const authUrl = await onStartOAuth2(oauthClientId, oauthClientSecret)
      const popup = window.open(authUrl, 'oauth2-popup', 'width=600,height=700,scrollbars=yes')
      setOauthPopup(popup)
    } catch (err) {
      setConnecting(false)
      setError(err instanceof Error ? err.message : t('pluginConnect.oauth2StartFailed'))
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
        <Dialog.Content
          style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 460, background: 'var(--surface)', borderRadius: 12,
            border: '1px solid var(--border)', padding: 24, zIndex: 201,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {pluginLogoUrl ? (
                <img src={pluginLogoUrl} alt={pluginDisplayName} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain' }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: 16 }}>
                  {pluginDisplayName.charAt(0)}
                </div>
              )}
              <Dialog.Title style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                {t('pluginConnect.connect')} {pluginDisplayName}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button aria-label={t('close')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Connected state */}
          {connected && (
            <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={18} color="#16a34a" />
              <span style={{ fontSize: 13, color: '#15803d', fontWeight: 500 }}>{t('pluginConnect.connected')}</span>
              <div style={{ flex: 1 }} />
              <Button variant="danger" size="sm" onClick={onDisconnect}>{t('pluginConnect.disconnect')}</Button>
            </div>
          )}

          {/* Dynamic multi-field form (piece declares its own auth field-schema) */}
          {isDynamic && !connected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                <Key size={14} />
                <span>{t('pluginConnect.dynamicAuth')}</span>
              </div>
              {authProps.map((prop) => (
                <div key={prop.name}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                    {prop.displayName}{prop.required ? ' *' : ''}
                  </label>
                  {prop.type === 'file' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <input
                        type="file"
                        aria-label={prop.displayName}
                        // Only the A1 certificate uses a file field today; filter the
                        // picker to cert bundles. Make this prop-driven if other file
                        // pieces appear.
                        accept=".pfx,.p12"
                        onChange={(e) => { void handleFileChange(prop, e.target.files?.[0] ?? null) }}
                        style={{ fontSize: 13, color: 'var(--text)' }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {fileNames[prop.name] || t('pluginConnect.noFileSelected')}
                      </span>
                    </div>
                  ) : prop.type === 'select' ? (
                    <select
                      aria-label={prop.displayName}
                      value={dynamicValues[prop.name] ?? ''}
                      onChange={(e) => { setDynamicValues((v) => ({ ...v, [prop.name]: e.target.value })); setError('') }}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
                    >
                      <option value="">{t('pluginConnect.selectOption')}</option>
                      {(prop.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={prop.type === 'secret' ? 'password' : 'text'}
                      placeholder={prop.displayName}
                      value={dynamicValues[prop.name] ?? ''}
                      onChange={(e) => { setDynamicValues((v) => ({ ...v, [prop.name]: e.target.value })); setError('') }}
                    />
                  )}
                </div>
              ))}
              <Button variant="primary" onClick={handleSaveDynamic} loading={saving}>
                {t('pluginConnect.connect')}
              </Button>
            </div>
          )}

          {/* No auth needed */}
          {authType === 'none' && !isDynamic && !connected && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {t('pluginConnect.noAuthRequired')}
            </div>
          )}

          {/* Secret text (API Key) */}
          {authType === 'secret_text' && !isDynamic && !connected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                <Key size={14} />
                <span>{t('pluginConnect.apiKeyAuth')}</span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{t('pluginConnect.apiKey')}</label>
                <Input
                  type="password"
                  placeholder={t('pluginConnect.apiKeyPlaceholder')}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setError('') }}
                />
              </div>
              <Button variant="primary" onClick={handleSaveSecretText} loading={saving}>
                {t('pluginConnect.connect')}
              </Button>
            </div>
          )}

          {/* Basic auth */}
          {authType === 'basic_auth' && !isDynamic && !connected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                <User size={14} />
                <span>{t('pluginConnect.basicAuth')}</span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{t('pluginConnect.username')}</label>
                <Input placeholder={t('pluginConnect.usernamePlaceholder')} value={username} onChange={(e) => { setUsername(e.target.value); setError('') }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{t('pluginConnect.password')}</label>
                <Input type="password" placeholder={t('pluginConnect.passwordPlaceholder')} value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />
              </div>
              <Button variant="primary" onClick={handleSaveBasicAuth} loading={saving}>
                {t('pluginConnect.connect')}
              </Button>
            </div>
          )}

          {/* OAuth2 */}
          {authType === 'oauth2' && !isDynamic && !connected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                <Globe size={14} />
                <span>{t('pluginConnect.oauth2Auth')}</span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{t('pluginConnect.clientId')}</label>
                <Input placeholder={t('pluginConnect.clientIdPlaceholder')} value={oauthClientId} onChange={(e) => { setOauthClientId(e.target.value); setError('') }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{t('pluginConnect.clientSecret')}</label>
                <Input type="password" placeholder={t('pluginConnect.clientSecretPlaceholder')} value={oauthClientSecret} onChange={(e) => { setOauthClientSecret(e.target.value); setError('') }} />
              </div>
              <Button variant="primary" onClick={handleOAuth2Connect} loading={connecting}>
                {connecting ? t('pluginConnect.connecting') : t('pluginConnect.connectOAuth2')}
              </Button>
            </div>
          )}

          {/* Custom auth (single-field fallback when no field-schema is declared) */}
          {authType === 'custom_auth' && !isDynamic && !connected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                <Key size={14} />
                <span>{t('pluginConnect.customAuth')}</span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{t('pluginConnect.apiKeyToken')}</label>
                <Input type="password" placeholder={t('pluginConnect.credentialsPlaceholder')} value={apiKey} onChange={(e) => { setApiKey(e.target.value); setError('') }} />
              </div>
              <Button variant="primary" onClick={handleSaveSecretText} loading={saving}>
                {t('pluginConnect.connect')}
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', marginTop: 12 }}>
              <AlertCircle size={14} color="#dc2626" />
              <span style={{ fontSize: 12, color: '#dc2626' }}>{error}</span>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
