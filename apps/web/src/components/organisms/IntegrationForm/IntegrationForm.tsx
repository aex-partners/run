import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '../../atoms/Input/Input'
import { Textarea } from '../../atoms/Textarea/Textarea'
import { Button } from '../../atoms/Button/Button'
import { CredentialField } from '../../molecules/CredentialField/CredentialField'
import { ExternalLink } from 'lucide-react'

export type IntegrationType = 'rest' | 'oauth2' | 'webhook'

export interface IntegrationFormData {
  name: string
  description: string
  type: IntegrationType
  credentials: Record<string, string>
  webhookSecret?: string
}

export interface IntegrationFormProps {
  initialData?: Partial<IntegrationFormData>
  onSubmit?: (data: IntegrationFormData) => void
  onCancel?: () => void
  onOAuthConnect?: (type: string) => void
  oauthUrl?: string
  loading?: boolean
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text)',
  display: 'block',
  marginBottom: 6,
}

const typeOptions: { value: IntegrationType; label: string; desc: string }[] = [
  { value: 'rest', label: 'REST API', desc: 'API key or basic auth' },
  { value: 'oauth2', label: 'OAuth2', desc: 'OAuth2 authorization flow' },
  { value: 'webhook', label: 'Webhook', desc: 'Receive events via webhook' },
]

const restCredFields = [
  { key: 'apiKey', label: 'API Key', placeholder: 'Enter API key...' },
  { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.example.com' },
]

const oauth2CredFields = [
  { key: 'clientId', label: 'Client ID', placeholder: 'Enter client ID...' },
  { key: 'clientSecret', label: 'Client Secret', placeholder: 'Enter client secret...' },
  { key: 'authUrl', label: 'Authorization URL', placeholder: 'https://provider.com/oauth/authorize' },
  { key: 'tokenUrl', label: 'Token URL', placeholder: 'https://provider.com/oauth/token' },
]

export function IntegrationForm({
  initialData,
  onSubmit,
  onCancel,
  onOAuthConnect,
  oauthUrl,
  loading = false,
}: IntegrationFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<IntegrationFormData>({
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    type: initialData?.type ?? 'rest',
    credentials: initialData?.credentials ?? {},
    webhookSecret: initialData?.webhookSecret ?? '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(form)
  }

  const setCred = (key: string, value: string) => {
    setForm((f) => ({ ...f, credentials: { ...f.credentials, [key]: value } }))
  }

  const isEdit = !!initialData?.name
  const credFields = form.type === 'oauth2' ? oauth2CredFields : form.type === 'rest' ? restCredFields : []

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>{t('integrations.form.name')}</label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder={t('integrations.form.namePlaceholder')}
        />
      </div>

      <div>
        <label style={labelStyle}>{t('integrations.form.description')}</label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder={t('integrations.form.descriptionPlaceholder')}
          rows={2}
        />
      </div>

      <div>
        <label style={labelStyle}>{t('integrations.form.type')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {typeOptions.map((tt) => (
            <button
              key={tt.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: tt.value }))}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: form.type === tt.value ? 'var(--accent-light)' : 'var(--surface)',
                border: `1px solid ${form.type === tt.value ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 8,
                cursor: 'pointer',
                textAlign: 'center',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: form.type === tt.value ? 'var(--accent)' : 'var(--text)' }}>
                {tt.label}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {credFields.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {credFields.map((f) =>
            f.key.toLowerCase().includes('secret') || f.key.toLowerCase().includes('key') ? (
              <CredentialField
                key={f.key}
                label={f.label}
                value={form.credentials[f.key] ?? ''}
                onChange={(e) => setCred(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            ) : (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <Input
                  value={form.credentials[f.key] ?? ''}
                  onChange={(e) => setCred(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              </div>
            )
          )}
        </div>
      )}

      {form.type === 'oauth2' && onOAuthConnect && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOAuthConnect(form.type)}
          leftIcon={<ExternalLink size={13} />}
        >
          {oauthUrl ? 'Reconnect' : 'Connect with OAuth2'}
        </Button>
      )}

      {form.type === 'webhook' && (
        <div>
          <label style={labelStyle}>{t('integrations.form.webhookSecret')}</label>
          <CredentialField
            value={form.webhookSecret ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))}
            placeholder="Enter webhook secret..."
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>{t('cancel')}</Button>
        )}
        <Button type="submit" variant="primary" loading={loading}>
          {isEdit ? t('integrations.form.saveChanges') : t('integrations.form.createIntegration')}
        </Button>
      </div>
    </form>
  )
}

export default IntegrationForm
