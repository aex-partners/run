import type { FormFieldItem } from './SortableFieldItem'
import { useTranslation } from 'react-i18next'

interface FormFieldConfiguratorProps {
  field: FormFieldItem
  onChange: (updated: FormFieldItem) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 12,
  color: 'var(--text)',
  background: 'var(--surface-2)',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

export function FormFieldConfigurator({ field, onChange }: FormFieldConfiguratorProps) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onChange({ ...field, required: e.target.checked })}
          style={{ accentColor: 'var(--accent)' }}
        />
        <span style={{ color: 'var(--text)' }}>{t('database.forms.builder.required')}</span>
      </label>

      <div>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
          {t('database.forms.builder.placeholder')}
        </label>
        <input
          type="text"
          value={field.placeholder ?? ''}
          onChange={(e) => onChange({ ...field, placeholder: e.target.value || undefined })}
          placeholder={t('database.forms.builder.placeholder')}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
          {t('database.forms.builder.helpText')}
        </label>
        <input
          type="text"
          value={field.helpText ?? ''}
          onChange={(e) => onChange({ ...field, helpText: e.target.value || undefined })}
          placeholder={t('database.forms.builder.helpText')}
          style={inputStyle}
        />
      </div>
    </div>
  )
}
