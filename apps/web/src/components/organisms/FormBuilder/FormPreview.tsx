import { useState } from 'react'
import type { FormFieldItem, EntityFieldInfo } from './SortableFieldItem'
import type { GridColumn } from '../DataGrid/types'
import { FormFieldEditor } from '../FormView/FormFieldEditor'

interface FormPreviewProps {
  fields: FormFieldItem[]
  entityFields: EntityFieldInfo[]
  title?: string
  description?: string
  submitButtonText?: string
}

export function FormPreview({
  fields,
  entityFields,
  title,
  description,
  submitButtonText = 'Submit',
}: FormPreviewProps) {
  const [values, setValues] = useState<Record<string, string>>({})

  const visibleFields = fields
    .filter((f) => f.visible)
    .sort((a, b) => a.order - b.order)

  const getEntityField = (entityFieldId: string) =>
    entityFields.find((ef) => ef.id === entityFieldId)

  const toGridColumn = (ef: EntityFieldInfo): GridColumn => ({
    id: ef.slug,
    label: ef.name,
    type: ef.type as GridColumn['type'],
  })

  return (
    <div style={{ padding: '24px 32px', maxWidth: 520 }}>
      {title && (
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          {title}
        </div>
      )}
      {description && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          {description}
        </div>
      )}
      {!title && !description && (
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 24, color: 'var(--text)' }}>
          Form Preview
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
              color: 'var(--text-muted)',
              marginBottom: 6,
            }}>
              {ef.name}
              {field.required && <span style={{ color: 'var(--accent)', marginLeft: 2 }}>*</span>}
            </label>
            <FormFieldEditor
              column={{ ...column, label: field.placeholder ?? column.label }}
              value={values[ef.slug] ?? ''}
              onChange={(v) => setValues((prev) => ({ ...prev, [ef.slug]: v }))}
            />
            {field.helpText && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {field.helpText}
              </div>
            )}
          </div>
        )
      })}

      {visibleFields.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
          No visible fields. Toggle field visibility to see the preview.
        </div>
      )}

      {visibleFields.length > 0 && (
        <button
          type="button"
          style={{
            padding: '8px 20px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'default',
            fontFamily: 'inherit',
            marginTop: 24,
            opacity: 0.7,
          }}
        >
          {submitButtonText}
        </button>
      )}
    </div>
  )
}
