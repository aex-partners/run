import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '../../atoms/Input/Input'
import { Textarea } from '../../atoms/Textarea/Textarea'
import { Button } from '../../atoms/Button/Button'
import { MultiSelect, type MultiSelectOption } from '../../molecules/MultiSelect/MultiSelect'

export interface AgentFormData {
  name: string
  description: string
  systemPrompt: string
  modelId: string
  skillIds: string[]
  toolIds: string[]
}

export interface AgentFormProps {
  initialData?: Partial<AgentFormData>
  skillOptions?: MultiSelectOption[]
  toolOptions?: MultiSelectOption[]
  onSubmit?: (data: AgentFormData) => void
  onCancel?: () => void
  loading?: boolean
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text)',
  display: 'block',
  marginBottom: 6,
}

export function AgentForm({
  initialData,
  skillOptions = [],
  toolOptions = [],
  onSubmit,
  onCancel,
  loading = false,
}: AgentFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AgentFormData>({
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    systemPrompt: initialData?.systemPrompt ?? '',
    modelId: initialData?.modelId ?? '',
    skillIds: initialData?.skillIds ?? [],
    toolIds: initialData?.toolIds ?? [],
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(form)
  }

  const isEdit = !!initialData?.name

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>{t('agents.form.name')}</label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder={t('agents.form.namePlaceholder')}
        />
      </div>

      <div>
        <label style={labelStyle}>{t('agents.form.description')}</label>
        <Input
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder={t('agents.form.descriptionPlaceholder')}
        />
      </div>

      <div>
        <label style={labelStyle}>{t('agents.form.systemPrompt')}</label>
        <Textarea
          value={form.systemPrompt}
          onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
          placeholder={t('agents.form.systemPromptPlaceholder')}
          rows={5}
        />
      </div>

      <div>
        <label style={labelStyle}>{t('agents.form.modelId')}</label>
        <Input
          value={form.modelId}
          onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
          placeholder={t('agents.form.modelIdPlaceholder')}
        />
      </div>

      <div>
        <label style={labelStyle}>{t('agents.form.skills')}</label>
        <MultiSelect
          options={skillOptions}
          selected={form.skillIds}
          onChange={(skillIds) => setForm((f) => ({ ...f, skillIds }))}
          placeholder={t('agents.form.skillsPlaceholder')}
        />
      </div>

      <div>
        <label style={labelStyle}>{t('agents.form.tools')}</label>
        <MultiSelect
          options={toolOptions}
          selected={form.toolIds}
          onChange={(toolIds) => setForm((f) => ({ ...f, toolIds }))}
          placeholder={t('agents.form.toolsPlaceholder')}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>{t('cancel')}</Button>
        )}
        <Button type="submit" variant="primary" loading={loading}>
          {isEdit ? t('agents.form.saveChanges') : t('agents.form.createAgent')}
        </Button>
      </div>
    </form>
  )
}

export default AgentForm
