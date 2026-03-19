import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, AlertCircle } from 'lucide-react'
import { trpc } from '../lib/trpc'
import { FormFieldEditor } from '../components/organisms/FormView/FormFieldEditor'
import type { GridColumn } from '../components/organisms/DataGrid/types'
import { useTranslation } from 'react-i18next'

export function PublicFormPage() {
  const { t } = useTranslation()
  const { token } = useParams<{ token: string }>()
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formQuery = trpc.forms.getPublicForm.useQuery(
    { token: token! },
    { enabled: !!token }
  )

  const submitMutation = trpc.forms.submitPublicForm.useMutation({
    onSuccess: () => {
      setSubmitted(true)
      setError(null)
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const form = formQuery.data

  if (formQuery.isLoading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ color: 'var(--text-muted, #6b7280)', fontSize: 14, textAlign: 'center' }}>
            Loading...
          </div>
        </div>
      </div>
    )
  }

  if (!form) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <AlertCircle size={32} style={{ color: '#dc2626', marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: '#374151', textAlign: 'center' }}>
            {t('database.forms.public.notFound')}
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#dcfce7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Check size={24} color="#16a34a" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
            {form.settings.successMessage}
          </div>
        </div>
      </div>
    )
  }

  const visibleFields = form.fields
    .filter((f) => f.visible)
    .sort((a, b) => a.order - b.order)

  const getEntityField = (entityFieldId: string) =>
    form.entityFields.find((ef) => ef.id === entityFieldId)

  const toGridColumn = (ef: typeof form.entityFields[0]): GridColumn => ({
    id: ef.slug,
    label: ef.name,
    type: ef.type as GridColumn['type'],
    options: ef.options?.map((o) => ({ value: o, label: o })),
  })

  const handleSubmit = () => {
    if (!token) return
    setError(null)

    // Build data keyed by slug
    const data: Record<string, unknown> = {}
    for (const field of visibleFields) {
      const ef = getEntityField(field.entityFieldId)
      if (!ef) continue
      const val = values[ef.slug]
      if (ef.type === 'number' && val) {
        data[ef.slug] = Number(val)
      } else if (ef.type === 'checkbox') {
        data[ef.slug] = val === 'true'
      } else {
        data[ef.slug] = val ?? ''
      }
    }

    submitMutation.mutate({ token, data })
  }

  return (
    <div style={containerStyle}>
      <div style={{ ...cardStyle, maxWidth: 520, width: '100%' }}>
        {form.settings.title && (
          <div style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
            {form.settings.title}
          </div>
        )}
        {(form.settings.description ?? form.description) && (
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
            {form.settings.description ?? form.description}
          </div>
        )}
        {!form.settings.title && (
          <div style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 20 }}>
            {form.name}
          </div>
        )}

        {visibleFields.map((field) => {
          const ef = getEntityField(field.entityFieldId)
          if (!ef) return null
          const column = toGridColumn(ef)

          return (
            <div key={field.id} style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                color: '#374151',
                marginBottom: 6,
              }}>
                {ef.name}
                {field.required && <span style={{ color: '#EA580C', marginLeft: 2 }}>*</span>}
              </label>
              <FormFieldEditor
                column={{ ...column, label: field.placeholder ?? column.label }}
                value={values[ef.slug] ?? ''}
                onChange={(v) => setValues((prev) => ({ ...prev, [ef.slug]: v }))}
              />
              {field.helpText && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  {field.helpText}
                </div>
              )}
            </div>
          )
        })}

        {error && (
          <div style={{
            padding: '8px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            fontSize: 12,
            color: '#dc2626',
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitMutation.isPending}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 24px',
            background: submitMutation.isPending ? '#9ca3af' : '#EA580C',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: submitMutation.isPending ? 'default' : 'pointer',
            fontFamily: 'inherit',
            marginTop: 24,
          }}
        >
          {submitMutation.isPending
            ? t('database.forms.public.submitting')
            : form.settings.submitButtonText}
        </button>
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f9fafb',
  padding: 24,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '32px 28px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  border: '1px solid #e5e7eb',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}
