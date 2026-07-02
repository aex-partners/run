import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GridColumn } from '../../database/DataGrid/types'
import { RelationshipPicker } from '../../database/RelationshipPicker/RelationshipPicker'

interface FormFieldEditorProps {
  column: GridColumn
  value: string
  onChange: (value: string) => void
  /** Fetch related records for relationship fields (omit for public forms). */
  onFetchRelationshipRecords?: (entityId: string, search: string) => Promise<{ id: string; label: string }[]>
}

export function FormFieldEditor({ column, value, onChange, onFetchRelationshipRecords }: FormFieldEditorProps) {
  const { t } = useTranslation()
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontSize: 13,
    color: 'var(--text)',
    background: 'var(--surface)',
    fontFamily: 'inherit',
    outline: 'none',
  }

  const readOnlyStyle: React.CSSProperties = {
    ...inputStyle,
    background: 'var(--surface-2, #f3f4f6)',
    color: 'var(--text-muted)',
    cursor: 'not-allowed',
  }

  switch (column.type) {
    case 'checkbox':
      return (
        <div style={{ padding: '8px 0' }}>
          <input
            type="checkbox"
            checked={value === 'true' || value === '1'}
            onChange={e => onChange(String(e.target.checked))}
            style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }}
          />
        </div>
      )

    case 'select':
    case 'status':
    case 'priority':
      if (column.options) {
        return (
          <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
            <option value="">{t('plugins.select')}</option>
            {column.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )
      }
      return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={column.label} style={inputStyle} />

    case 'multiselect': {
      const selectedValues = value ? value.split(',').map(v => v.trim()).filter(Boolean) : []
      const options = column.options ?? []
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {options.map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedValues.includes(opt.value)}
                onChange={e => {
                  const next = e.target.checked
                    ? [...selectedValues, opt.value]
                    : selectedValues.filter(v => v !== opt.value)
                  onChange(next.join(','))
                }}
                style={{ accentColor: 'var(--accent)' }}
              />
              {opt.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />}
              {opt.label}
            </label>
          ))}
        </div>
      )
    }

    case 'number':
      return <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={column.label} style={inputStyle} />

    case 'decimal':
      return <input type="number" step={Math.pow(10, -(column.decimalPlaces ?? 2))} value={value} onChange={e => onChange(e.target.value)} placeholder={column.label} style={inputStyle} />

    case 'currency':
      return (
        <div style={{ position: 'relative' }}>
          <input type="number" step="0.01" value={value} onChange={e => onChange(e.target.value)} placeholder={column.label} style={{ ...inputStyle, paddingRight: 40 }} />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)' }}>
            {column.currencyCode || 'BRL'}
          </span>
        </div>
      )

    case 'percent':
      return (
        <div style={{ position: 'relative' }}>
          <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={column.label} style={{ ...inputStyle, paddingRight: 30 }} />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)' }}>%</span>
        </div>
      )

    case 'email':
      return <input type="email" value={value} onChange={e => onChange(e.target.value)} placeholder={column.label} style={inputStyle} />

    case 'url':
      return <input type="url" value={value} onChange={e => onChange(e.target.value)} placeholder={column.label} style={inputStyle} />

    case 'phone':
      return <input type="tel" value={value} onChange={e => onChange(e.target.value)} placeholder={column.label} style={inputStyle} />

    case 'date':
      return <input type="date" value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />

    case 'datetime':
      return <input type="datetime-local" value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />

    case 'duration':
      return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={t('formFieldEditor.durationPlaceholder')} style={inputStyle} />

    case 'long_text':
    case 'rich_text':
      return (
        <textarea
          rows={4}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={column.label}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
        />
      )

    case 'json':
      return (
        <textarea
          rows={6}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder='{ "key": "value" }'
          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', minHeight: 100 }}
        />
      )

    case 'rating': {
      const maxRating = column.maxRating ?? 5
      const currentRating = Number(value) || 0
      return (
        <div style={{ display: 'flex', gap: 2, padding: '8px 0' }}>
          {Array.from({ length: maxRating }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(String(i + 1 === currentRating ? 0 : i + 1))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
            >
              <Star
                size={20}
                fill={i < currentRating ? 'var(--accent)' : 'none'}
                color={i < currentRating ? 'var(--accent)' : '#d1d5db'}
              />
            </button>
          ))}
        </div>
      )
    }

    case 'barcode':
      return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={column.label} style={{ ...inputStyle, fontFamily: 'monospace' }} />

    case 'person':
      return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={column.label} style={inputStyle} />

    case 'relationship':
      return (
        <RelationshipPicker
          entityId={column.relationshipEntityId}
          value={value}
          onChange={onChange}
          onFetch={onFetchRelationshipRecords}
          placeholder={column.label}
          inputStyle={inputStyle}
        />
      )

    case 'attachment':
      return (
        <div style={{ padding: '8px 0' }}>
          <input type="file" onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onChange(file.name)
          }} style={{ fontSize: 13 }} />
          {value && <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>{value}</span>}
        </div>
      )

    case 'ai':
      return (
        <div>
          {value && <div style={{ ...inputStyle, marginBottom: 8, background: 'var(--surface-2, #f3f4f6)' }}>{value}</div>}
          <button
            type="button"
            onClick={() => onChange(t('formFieldEditor.aiGeneratedContent'))}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', background: 'var(--accent-light)', border: '1px solid var(--accent-border)',
              borderRadius: 6, fontSize: 12, color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t('database.ai.generate')}
          </button>
        </div>
      )

    case 'formula':
    case 'lookup':
    case 'rollup':
    case 'autonumber':
      return <div style={readOnlyStyle}>{value || t('formFieldEditor.computedField')}</div>

    case 'created_at':
    case 'updated_at':
      return <div style={readOnlyStyle}>{value || t('formFieldEditor.autoGenerated')}</div>

    case 'created_by':
    case 'updated_by':
      return <div style={readOnlyStyle}>{value || t('formFieldEditor.autoGenerated')}</div>

    default:
      return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={column.label} style={inputStyle} />
  }
}
