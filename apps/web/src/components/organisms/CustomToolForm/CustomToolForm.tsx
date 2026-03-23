import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '../../atoms/Input/Input'
import { Textarea } from '../../atoms/Textarea/Textarea'
import { Toggle } from '../../atoms/Toggle/Toggle'
import { Button } from '../../atoms/Button/Button'
import { JsonEditor } from '../../molecules/JsonEditor/JsonEditor'
import { CheckCircle2, XCircle } from 'lucide-react'

export type CustomToolType = 'http' | 'query' | 'code' | 'composite'

export interface CustomToolFormData {
  name: string
  description: string
  type: CustomToolType
  inputSchema: string
  config: string
  isReadOnly: boolean
  integrationId?: string
}

export interface TestResult {
  success: boolean
  result?: string
  error?: string
}

export interface CustomToolFormProps {
  initialData?: Partial<CustomToolFormData>
  integrationOptions?: { value: string; label: string }[]
  onSubmit?: (data: CustomToolFormData) => void
  onCancel?: () => void
  onTest?: (data: CustomToolFormData) => void
  testResult?: TestResult | null
  loading?: boolean
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text)',
  display: 'block',
  marginBottom: 6,
}

const toolTypes: { value: CustomToolType; label: string; desc: string }[] = [
  { value: 'http', label: 'HTTP', desc: 'Call an external REST API' },
  { value: 'query', label: 'Query', desc: 'Execute a database query' },
  { value: 'code', label: 'Code', desc: 'Run a JavaScript function' },
  { value: 'composite', label: 'Composite', desc: 'Chain multiple tools' },
]

export function CustomToolForm({
  initialData,
  integrationOptions = [],
  onSubmit,
  onCancel,
  onTest,
  testResult,
  loading = false,
}: CustomToolFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<CustomToolFormData>({
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    type: initialData?.type ?? 'http',
    inputSchema: initialData?.inputSchema ?? '{\n  "type": "object",\n  "properties": {}\n}',
    config: initialData?.config ?? '{}',
    isReadOnly: initialData?.isReadOnly ?? false,
    integrationId: initialData?.integrationId,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(form)
  }

  const isEdit = !!initialData?.name

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>{t('customTools.form.name')}</label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder={t('customTools.form.namePlaceholder')}
        />
      </div>

      <div>
        <label style={labelStyle}>{t('customTools.form.description')}</label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder={t('customTools.form.descriptionPlaceholder')}
          rows={2}
        />
      </div>

      <div>
        <label style={labelStyle}>{t('customTools.form.type')}</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {toolTypes.map((tt) => (
            <button
              key={tt.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: tt.value }))}
              style={{
                padding: '8px 12px',
                background: form.type === tt.value ? 'var(--accent-light)' : 'var(--surface)',
                border: `1px solid ${form.type === tt.value ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 8,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: form.type === tt.value ? 'var(--accent)' : 'var(--text)' }}>
                {tt.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>{t('customTools.form.inputSchema')}</label>
        <JsonEditor
          value={form.inputSchema}
          onChange={(inputSchema) => setForm((f) => ({ ...f, inputSchema }))}
          rows={6}
        />
      </div>

      <div>
        <label style={labelStyle}>{t('customTools.form.configuration')}</label>
        <JsonEditor
          value={form.config}
          onChange={(config) => setForm((f) => ({ ...f, config }))}
          rows={4}
        />
      </div>

      {integrationOptions.length > 0 && (
        <div>
          <label style={labelStyle}>{t('customTools.form.integration')}</label>
          <select
            value={form.integrationId ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, integrationId: e.target.value || undefined }))}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            <option value="">{t('none')}</option>
            {integrationOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 13, color: 'var(--text)' }}>{t('customTools.form.readOnly')}</label>
        <Toggle
          checked={form.isReadOnly}
          onChange={(isReadOnly) => setForm((f) => ({ ...f, isReadOnly }))}
          size="sm"
        />
      </div>

      {onTest && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: testResult ? 10 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('customTools.form.testPanel')}</span>
            <Button type="button" variant="secondary" size="sm" onClick={() => onTest(form)}>
              {t('customTools.form.runTest')}
            </Button>
          </div>
          {testResult && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: testResult.success ? 'var(--success-light)' : 'var(--danger-light)',
                border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              {testResult.success ? (
                <CheckCircle2 size={14} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} />
              ) : (
                <XCircle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
              )}
              <pre style={{ margin: 0, fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                {testResult.success ? testResult.result : testResult.error}
              </pre>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>{t('cancel')}</Button>
        )}
        <Button type="submit" variant="primary" loading={loading}>
          {isEdit ? t('customTools.form.saveChanges') : t('customTools.form.createTool')}
        </Button>
      </div>
    </form>
  )
}

export default CustomToolForm
