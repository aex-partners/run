import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import type { GridColumn, FilterCondition } from '../types'

type FilterOperator = FilterCondition['operator']

interface FilterBuilderProps {
  conditions: FilterCondition[]
  columns: GridColumn[]
  onAdd: (condition: FilterCondition) => void
  onRemove: (index: number) => void
  onClear: () => void
}

const operators: { value: FilterOperator; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'equals', label: 'equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
]

export function FilterBuilder({ conditions, columns, onAdd, onRemove, onClear }: FilterBuilderProps) {
  const { t } = useTranslation()
  const [newColumnId, setNewColumnId] = useState(columns[0]?.id ?? '')
  const [newOperator, setNewOperator] = useState<FilterOperator>('contains')
  const [newValue, setNewValue] = useState('')

  const handleAdd = () => {
    if (!newColumnId) return
    onAdd({ columnId: newColumnId, operator: newOperator, value: newValue })
    setNewValue('')
  }

  const needsValue = newOperator !== 'isEmpty' && newOperator !== 'isNotEmpty'

  const selectStyle: React.CSSProperties = {
    padding: '4px 8px',
    border: '1px solid var(--border)',
    borderRadius: 4,
    fontSize: 12,
    color: 'var(--text)',
    background: 'var(--surface)',
    fontFamily: 'inherit',
    outline: 'none',
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      padding: '12px',
      minWidth: 320,
    }}>
      {/* Existing conditions */}
      {conditions.map((cond, i) => {
        const col = columns.find(c => c.id === cond.columnId)
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, minWidth: 60 }}>
              {col?.label ?? cond.columnId}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {operators.find(o => o.value === cond.operator)?.label}
            </span>
            {cond.value && (
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
                "{cond.value}"
              </span>
            )}
            <button
              onClick={() => onRemove(i)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                color: 'var(--text-muted)',
                marginLeft: 'auto',
              }}
            >
              <X size={12} />
            </button>
          </div>
        )
      })}

      {/* New condition row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: conditions.length > 0 ? 8 : 0 }}>
        <select value={newColumnId} onChange={e => setNewColumnId(e.target.value)} style={selectStyle}>
          {columns.map(col => (
            <option key={col.id} value={col.id}>{col.label}</option>
          ))}
        </select>
        <select value={newOperator} onChange={e => setNewOperator(e.target.value as FilterOperator)} style={selectStyle}>
          {operators.map(op => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
        {needsValue && (
          <input
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder={t('database.filterOptions.value')}
            style={{
              ...selectStyle,
              flex: 1,
              minWidth: 80,
            }}
          />
        )}
        <button
          onClick={handleAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={11} /> Add
        </button>
      </div>

      {conditions.length > 0 && (
        <button
          onClick={onClear}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 11,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginTop: 8,
          }}
        >
          Clear all filters
        </button>
      )}
    </div>
  )
}
