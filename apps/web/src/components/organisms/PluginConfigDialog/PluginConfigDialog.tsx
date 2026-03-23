import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from '../../atoms/Button/Button'
import { useTranslation } from 'react-i18next'

interface ConfigField {
  key: string
  type: string
  description?: string
  required: boolean
  default?: unknown
  enum?: unknown[]
}

export interface PluginConfigDialogProps {
  open: boolean
  onClose: () => void
  pluginName: string
  configSchema?: {
    type?: string
    properties?: Record<string, {
      type?: string
      description?: string
      default?: unknown
      enum?: unknown[]
    }>
    required?: string[]
  } | null
  currentConfig?: Record<string, unknown>
  onSave: (config: Record<string, unknown>) => void
  loading?: boolean
}

function parseFields(schema: PluginConfigDialogProps['configSchema']): ConfigField[] {
  if (!schema?.properties) return []
  const required = new Set(schema.required ?? [])

  return Object.entries(schema.properties).map(([key, prop]) => ({
    key,
    type: prop.type ?? 'string',
    description: prop.description,
    required: required.has(key),
    default: prop.default,
    enum: prop.enum,
  }))
}

export function PluginConfigDialog({
  open,
  onClose,
  pluginName,
  configSchema,
  currentConfig = {},
  onSave,
  loading = false,
}: PluginConfigDialogProps) {
  const { t } = useTranslation()
  const fields = parseFields(configSchema)
  const [values, setValues] = useState<Record<string, unknown>>({})

  useEffect(() => {
    const initial: Record<string, unknown> = {}
    for (const field of fields) {
      initial[field.key] = currentConfig[field.key] ?? field.default ?? (field.type === 'boolean' ? false : '')
    }
    setValues(initial)
  }, [configSchema, currentConfig])

  const handleChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(values)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
        <Dialog.Content
          style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 480, maxHeight: '80vh', overflow: 'auto',
            background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 24, zIndex: 201,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Dialog.Title style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
              {t('configure')} {pluginName}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {fields.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
              {t('plugins.noConfig')}
            </p>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {fields.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={`plugin-config-${field.key}`}
                    style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 6 }}
                  >
                    {field.key}
                    {field.required && <span style={{ color: 'var(--danger)', marginLeft: 4 }}>*</span>}
                  </label>
                  {field.description && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px' }}>{field.description}</p>
                  )}
                  {field.type === 'boolean' ? (
                    <input
                      id={`plugin-config-${field.key}`}
                      type="checkbox"
                      checked={Boolean(values[field.key])}
                      onChange={(e) => handleChange(field.key, e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                    />
                  ) : field.enum ? (
                    <select
                      id={`plugin-config-${field.key}`}
                      value={String(values[field.key] ?? '')}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
                      }}
                    >
                      <option value="">{t('plugins.select')}</option>
                      {field.enum.map((val) => (
                        <option key={String(val)} value={String(val)}>{String(val)}</option>
                      ))}
                    </select>
                  ) : field.type === 'number' ? (
                    <input
                      id={`plugin-config-${field.key}`}
                      type="number"
                      value={values[field.key] !== undefined ? Number(values[field.key]) : ''}
                      onChange={(e) => handleChange(field.key, e.target.value ? Number(e.target.value) : undefined)}
                      required={field.required}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    <input
                      id={`plugin-config-${field.key}`}
                      type={field.key.toLowerCase().includes('pass') || field.key.toLowerCase().includes('secret') ? 'password' : 'text'}
                      value={String(values[field.key] ?? '')}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      required={field.required}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <Button variant="secondary" size="sm" onClick={onClose} type="button">{t('cancel')}</Button>
                <Button variant="primary" size="sm" type="submit" loading={loading}>{t('save')}</Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default PluginConfigDialog
