import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { FormFieldConfigurator } from './FormFieldConfigurator'
import { useTranslation } from 'react-i18next'

export interface FormFieldItem {
  id: string
  entityFieldId: string
  order: number
  required: boolean
  placeholder?: string
  helpText?: string
  visible: boolean
}

export interface EntityFieldInfo {
  id: string
  name: string
  slug: string
  type: string
}

interface SortableFieldItemProps {
  field: FormFieldItem
  entityField?: EntityFieldInfo
  onChange: (updated: FormFieldItem) => void
}

export function SortableFieldItem({ field, entityField, onChange }: SortableFieldItemProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        marginBottom: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          style={{
            cursor: 'grab',
            display: 'flex',
            color: 'var(--text-muted)',
            padding: 2,
            flexShrink: 0,
          }}
        >
          <GripVertical size={14} />
        </div>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          {entityField?.name ?? field.entityFieldId}
        </span>
        <span style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          background: 'var(--surface-2)',
          padding: '1px 6px',
          borderRadius: 4,
        }}>
          {entityField?.type ?? 'text'}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onChange({ ...field, visible: !field.visible })
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            padding: 2,
            color: field.visible ? 'var(--text-muted)' : 'var(--text-muted)',
            opacity: field.visible ? 1 : 0.4,
          }}
          title={t('database.forms.builder.visible')}
        >
          {field.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        {expanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
      </div>

      {expanded && (
        <div style={{ padding: '0 10px 10px', borderTop: '1px solid var(--border)' }}>
          <FormFieldConfigurator field={field} onChange={onChange} />
        </div>
      )}
    </div>
  )
}
