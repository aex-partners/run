import { useCallback, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { SortableFieldItem, type FormFieldItem, type EntityFieldInfo } from './SortableFieldItem'
import { FormPreview } from './FormPreview'
import { FormSharePanel } from './FormSharePanel'
import { t } from '../../../locales/en'

export interface FormSettings {
  submitButtonText: string
  successMessage: string
  title?: string
  description?: string
}

export interface FormBuilderProps {
  formId: string
  formName: string
  fields: FormFieldItem[]
  entityFields: EntityFieldInfo[]
  settings: FormSettings
  isPublic: boolean
  publicToken?: string | null
  submissionCount: number
  onFieldsChange: (fields: FormFieldItem[]) => void
  onSettingsChange: (settings: FormSettings) => void
  onTogglePublic: () => void
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

export function FormBuilder({
  fields,
  entityFields,
  settings,
  isPublic,
  publicToken,
  submissionCount,
  onFieldsChange,
  onSettingsChange,
  onTogglePublic,
}: FormBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = fields.findIndex((f) => f.id === active.id)
      const newIndex = fields.findIndex((f) => f.id === over.id)
      const reordered = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({
        ...f,
        order: i,
      }))
      onFieldsChange(reordered)
    },
    [fields, onFieldsChange]
  )

  const handleFieldChange = useCallback(
    (updated: FormFieldItem) => {
      onFieldsChange(fields.map((f) => (f.id === updated.id ? updated : f)))
    },
    [fields, onFieldsChange]
  )

  const [showSettings, setShowSettings] = useState(false)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Field config list */}
        <div style={{
          width: '50%',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {t.database.forms.builder.fields}
            </span>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                background: showSettings ? 'var(--accent-light)' : 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 11,
                cursor: 'pointer',
                color: showSettings ? 'var(--accent)' : 'var(--text-muted)',
                fontFamily: 'inherit',
              }}
            >
              Settings
            </button>
          </div>

          {showSettings && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {t.database.forms.builder.formTitle}
                  </label>
                  <input
                    type="text"
                    value={settings.title ?? ''}
                    onChange={(e) => onSettingsChange({ ...settings, title: e.target.value || undefined })}
                    placeholder="Optional title"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {t.database.forms.builder.formDescription}
                  </label>
                  <input
                    type="text"
                    value={settings.description ?? ''}
                    onChange={(e) => onSettingsChange({ ...settings, description: e.target.value || undefined })}
                    placeholder="Optional description"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {t.database.forms.builder.submitButton}
                  </label>
                  <input
                    type="text"
                    value={settings.submitButtonText}
                    onChange={(e) => onSettingsChange({ ...settings, submitButtonText: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {t.database.forms.builder.successMessage}
                  </label>
                  <input
                    type="text"
                    value={settings.successMessage}
                    onChange={(e) => onSettingsChange({ ...settings, successMessage: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
            <ScrollArea.Viewport style={{ height: '100%', padding: 12 }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {fields
                    .sort((a, b) => a.order - b.order)
                    .map((field) => {
                      const entityField = entityFields.find((ef) => ef.id === field.entityFieldId)
                      return (
                        <SortableFieldItem
                          key={field.id}
                          field={field}
                          entityField={entityField}
                          onChange={handleFieldChange}
                        />
                      )
                    })}
                </SortableContext>
              </DndContext>

              {fields.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
                  No fields configured.
                </div>
              )}
            </ScrollArea.Viewport>
          </ScrollArea.Root>
        </div>

        {/* Live preview */}
        <div style={{ width: '50%', overflow: 'auto', background: 'var(--surface-2)' }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {t.database.forms.builder.preview}
            </span>
          </div>
          <FormPreview
            fields={fields}
            entityFields={entityFields}
            title={settings.title}
            description={settings.description}
            submitButtonText={settings.submitButtonText}
          />
        </div>
      </div>

      {/* Share panel at bottom */}
      <FormSharePanel
        isPublic={isPublic}
        publicToken={publicToken}
        submissionCount={submissionCount}
        onTogglePublic={onTogglePublic}
      />
    </div>
  )
}
