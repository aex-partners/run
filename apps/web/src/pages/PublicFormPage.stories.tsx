import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Check, AlertCircle } from 'lucide-react'
import { FormFieldEditor } from '../components/organisms/FormView/FormFieldEditor'
import type { GridColumn } from '../components/organisms/DataGrid/types'

// Standalone preview since the actual page uses tRPC + router
function PublicFormPreview() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const fields = [
    { id: 'f1', entityFieldId: 'ef1', order: 0, required: true, visible: true, placeholder: 'Acme Corp' },
    { id: 'f2', entityFieldId: 'ef2', order: 1, required: true, visible: true, helpText: 'Email comercial de preferencia' },
    { id: 'f3', entityFieldId: 'ef3', order: 2, required: false, visible: true },
    { id: 'f4', entityFieldId: 'ef4', order: 3, required: false, visible: true },
  ]

  const entityFields = [
    { id: 'ef1', name: 'Company Name', slug: 'company_name', type: 'text' as const },
    { id: 'ef2', name: 'Contact Email', slug: 'contact_email', type: 'email' as const },
    { id: 'ef3', name: 'Phone', slug: 'phone', type: 'phone' as const },
    { id: 'ef4', name: 'Active', slug: 'active', type: 'checkbox' as const },
  ]

  if (submitted) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: '#dcfce7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <Check size={24} color="#16a34a" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
            Thank you for your submission.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={{ ...cardStyle, maxWidth: 520, width: '100%', alignItems: 'stretch' }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
          Cadastro de Clientes
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
          Preencha as informacoes abaixo para registrar um novo cliente.
        </div>

        {fields.map((field) => {
          const ef = entityFields.find((e) => e.id === field.entityFieldId)!
          const column: GridColumn = { id: ef.slug, label: field.placeholder ?? ef.name, type: ef.type }

          return (
            <div key={field.id} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                {ef.name}
                {field.required && <span style={{ color: '#EA580C', marginLeft: 2 }}>*</span>}
              </label>
              <FormFieldEditor
                column={column}
                value={values[ef.slug] ?? ''}
                onChange={(v) => setValues((prev) => ({ ...prev, [ef.slug]: v }))}
              />
              {field.helpText && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{field.helpText}</div>
              )}
            </div>
          )
        })}

        <button
          onClick={() => setSubmitted(true)}
          style={{
            padding: '10px 24px', background: '#EA580C', border: 'none', borderRadius: 6,
            color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginTop: 24,
          }}
        >
          Submit
        </button>
      </div>
    </div>
  )
}

function PublicFormNotFound() {
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <AlertCircle size={32} style={{ color: '#dc2626', marginBottom: 12 }} />
        <div style={{ fontSize: 14, color: '#374151' }}>Form not found or no longer available.</div>
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#f9fafb', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: '32px 28px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
}

const meta: Meta = {
  title: 'Pages/PublicFormPage',
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
}
export default meta

export const Default: StoryObj = {
  render: () => <PublicFormPreview />,
}

export const NotFound: StoryObj = {
  render: () => <PublicFormNotFound />,
}
