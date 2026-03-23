import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Key, Globe, User, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '../../atoms/Button/Button'
import { Input } from '../../atoms/Input/Input'

export interface PluginConnectDialogProps {
  open: boolean
  onClose: () => void
  pluginName: string
  pluginDisplayName: string
  pluginLogoUrl?: string
  authType: 'oauth2' | 'secret_text' | 'basic_auth' | 'custom_auth' | 'none'
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

export function PluginConnectDialog({
  open,
  onClose,
  pluginName,
  pluginDisplayName,
  pluginLogoUrl,
  authType,
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

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setApiKey('')
      setUsername('')
      setPassword('')
      setOauthClientId('')
      setOauthClientSecret('')
      setError('')
      setConnecting(false)
    }
  }, [open])

  const handleSaveSecretText = () => {
    if (!apiKey.trim()) {
      setError(t('pluginConnect.apiKeyRequired'))
      return
    }
    onSaveCredential({ type: 'SECRET_TEXT', secret_text: apiKey })
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
      // Open popup
      const popup = window.open(authUrl, 'oauth2-popup', 'width=600,height=700,scrollbars=yes')

      // Listen for completion message from popup
      const handler = (event: MessageEvent) => {
        if (event.origin !== new URL(import.meta.env.VITE_API_URL || window.location.origin).origin) return
        if (event.data?.type === 'plugin-oauth-complete') {
          window.removeEventListener('message', handler)
          setConnecting(false)
          onClose()
        } else if (event.data?.type === 'plugin-oauth-error') {
          window.removeEventListener('message', handler)
          setConnecting(false)
          setError(event.data.error || t('pluginConnect.oauth2Failed'))
        }
      }
      window.addEventListener('message', handler)

      // Also check if popup was closed without completing
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handler)
          setConnecting(false)
        }
      }, 1000)
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

          {/* No auth needed */}
          {authType === 'none' && !connected && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {t('pluginConnect.noAuthRequired')}
            </div>
          )}

          {/* Secret text (API Key) */}
          {authType === 'secret_text' && !connected && (
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
          {authType === 'basic_auth' && !connected && (
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
          {authType === 'oauth2' && !connected && (
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

          {/* Custom auth */}
          {authType === 'custom_auth' && !connected && (
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
