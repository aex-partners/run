import { useState, useCallback, useEffect } from 'react'
import { FormSidebar, type FormItem } from '../../molecules/FormSidebar/FormSidebar'
import { FormBuilder, type FormSettings } from '../FormBuilder/FormBuilder'
import type { FormFieldItem, EntityFieldInfo } from '../FormBuilder/SortableFieldItem'
import { trpc } from '../../../lib/trpc'
import { t } from '../../../locales/en'

export interface FormViewProps {
  entityId: string
  entityFields: EntityFieldInfo[]
}

export function FormView({ entityId, entityFields }: FormViewProps) {
  const [activeFormId, setActiveFormId] = useState<string | undefined>()

  const formsQuery = trpc.forms.listByEntity.useQuery(
    { entityId },
    { enabled: !!entityId }
  )

  const formDetailQuery = trpc.forms.getById.useQuery(
    { id: activeFormId! },
    { enabled: !!activeFormId }
  )

  const submissionsQuery = trpc.forms.listSubmissions.useQuery(
    { formId: activeFormId! },
    { enabled: !!activeFormId }
  )

  const createForm = trpc.forms.create.useMutation({
    onSuccess: (data) => {
      formsQuery.refetch()
      setActiveFormId(data.id)
    },
  })

  const updateForm = trpc.forms.update.useMutation({
    onSuccess: () => formsQuery.refetch(),
  })

  const deleteForm = trpc.forms.delete.useMutation({
    onSuccess: () => {
      formsQuery.refetch()
      setActiveFormId(undefined)
    },
  })

  const togglePublic = trpc.forms.togglePublic.useMutation({
    onSuccess: () => {
      formDetailQuery.refetch()
      formsQuery.refetch()
    },
  })

  // Auto-select first form
  useEffect(() => {
    if (!activeFormId && formsQuery.data && formsQuery.data.length > 0) {
      setActiveFormId(formsQuery.data[0].id)
    }
  }, [activeFormId, formsQuery.data])

  // Reset when entity changes
  useEffect(() => {
    setActiveFormId(undefined)
  }, [entityId])

  const formItems: FormItem[] = (formsQuery.data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    isPublic: f.isPublic,
    publicToken: f.publicToken,
  }))

  const activeForm = formDetailQuery.data

  const handleFieldsChange = useCallback(
    (fields: FormFieldItem[]) => {
      if (!activeFormId) return
      updateForm.mutate({ id: activeFormId, fields })
    },
    [activeFormId, updateForm]
  )

  const handleSettingsChange = useCallback(
    (settings: FormSettings) => {
      if (!activeFormId) return
      updateForm.mutate({ id: activeFormId, settings })
    },
    [activeFormId, updateForm]
  )

  const handleTogglePublic = useCallback(() => {
    if (!activeFormId) return
    togglePublic.mutate({ id: activeFormId })
  }, [activeFormId, togglePublic])

  const handleNewForm = useCallback(() => {
    createForm.mutate({ entityId, name: 'New Form' })
  }, [entityId, createForm])

  const handleRenameForm = useCallback(
    (id: string, name: string) => {
      updateForm.mutate({ id, name })
    },
    [updateForm]
  )

  const handleDeleteForm = useCallback(
    (id: string) => {
      deleteForm.mutate({ id })
    },
    [deleteForm]
  )

  const handleCopyLink = useCallback(
    (id: string) => {
      const form = formsQuery.data?.find((f) => f.id === id)
      if (form?.publicToken) {
        navigator.clipboard.writeText(`${window.location.origin}/f/${form.publicToken}`)
      }
    },
    [formsQuery.data]
  )

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <FormSidebar
        forms={formItems}
        activeFormId={activeFormId}
        onFormSelect={setActiveFormId}
        onNewForm={handleNewForm}
        onRenameForm={handleRenameForm}
        onDeleteForm={handleDeleteForm}
        onCopyLink={handleCopyLink}
      />

      {activeForm ? (
        <FormBuilder
          formId={activeForm.id}
          formName={activeForm.name}
          fields={activeForm.fields as FormFieldItem[]}
          entityFields={entityFields}
          settings={activeForm.settings as FormSettings}
          isPublic={activeForm.isPublic}
          publicToken={activeForm.publicToken}
          submissionCount={submissionsQuery.data?.length ?? 0}
          onFieldsChange={handleFieldsChange}
          onSettingsChange={handleSettingsChange}
          onTogglePublic={handleTogglePublic}
        />
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}>
          {formItems.length === 0
            ? t.database.forms.noForms
            : 'Select a form to edit.'}
        </div>
      )}
    </div>
  )
}
