import type { GridColumn } from '../DataGrid/types'

interface FormFieldEditorProps {
  column: GridColumn
  value: string
  onChange: (value: string) => void
}

export function FormFieldEditor({ column, value, onChange }: FormFieldEditorProps) {
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

  if (column.type === 'checkbox') {
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
  }

  if (column.type === 'select' && column.options) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      >
        <option value="">Select...</option>
        {column.options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    )
  }

  if (column.type === 'number' || column.type === 'currency') {
    return (
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={column.label}
        style={inputStyle}
      />
    )
  }

  if (column.type === 'email') {
    return (
      <input
        type="email"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={column.label}
        style={inputStyle}
      />
    )
  }

  if (column.type === 'url') {
    return (
      <input
        type="url"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={column.label}
        style={inputStyle}
      />
    )
  }

  if (column.type === 'phone') {
    return (
      <input
        type="tel"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={column.label}
        style={inputStyle}
      />
    )
  }

  if (column.type === 'date') {
    return (
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      />
    )
  }

  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={column.label}
      style={inputStyle}
    />
  )
}
