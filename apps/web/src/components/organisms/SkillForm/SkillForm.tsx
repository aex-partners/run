import React, { useState } from 'react'
import { Input } from '../../atoms/Input/Input'
import { Textarea } from '../../atoms/Textarea/Textarea'
import { Toggle } from '../../atoms/Toggle/Toggle'
import { Button } from '../../atoms/Button/Button'
import { MultiSelect, type MultiSelectOption } from '../../molecules/MultiSelect/MultiSelect'

export interface SkillFormData {
  name: string
  description: string
  systemPrompt: string
  toolIds: string[]
  systemToolNames: string[]
  guardrails: {
    maxSteps?: number
    blockedTools?: string[]
    requireConfirmation?: boolean
  }
}

export interface SkillFormProps {
  initialData?: Partial<SkillFormData>
  toolOptions?: MultiSelectOption[]
  systemToolOptions?: MultiSelectOption[]
  onSubmit?: (data: SkillFormData) => void
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

export function SkillForm({
  initialData,
  toolOptions = [],
  systemToolOptions = [],
  onSubmit,
  onCancel,
  loading = false,
}: SkillFormProps) {
  const [form, setForm] = useState<SkillFormData>({
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    systemPrompt: initialData?.systemPrompt ?? '',
    toolIds: initialData?.toolIds ?? [],
    systemToolNames: initialData?.systemToolNames ?? [],
    guardrails: initialData?.guardrails ?? {},
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(form)
  }

  const isEdit = !!initialData?.name

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>Name</label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Order Management"
        />
      </div>

      <div>
        <label style={labelStyle}>Description</label>
        <Input
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="What does this skill enable?"
        />
      </div>

      <div>
        <label style={labelStyle}>System Prompt</label>
        <Textarea
          value={form.systemPrompt}
          onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
          placeholder="Instructions for this skill..."
          rows={4}
        />
      </div>

      <div>
        <label style={labelStyle}>Custom Tools</label>
        <MultiSelect
          options={toolOptions}
          selected={form.toolIds}
          onChange={(toolIds) => setForm((f) => ({ ...f, toolIds }))}
          placeholder="Select custom tools..."
        />
      </div>

      <div>
        <label style={labelStyle}>System Tools</label>
        <MultiSelect
          options={systemToolOptions}
          selected={form.systemToolNames}
          onChange={(systemToolNames) => setForm((f) => ({ ...f, systemToolNames }))}
          placeholder="Select system tools..."
        />
      </div>

      <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Guardrails</span>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: 13, color: 'var(--text)' }}>Require Confirmation</label>
          <Toggle
            checked={form.guardrails.requireConfirmation ?? false}
            onChange={(checked) => setForm((f) => ({ ...f, guardrails: { ...f.guardrails, requireConfirmation: checked } }))}
            size="sm"
          />
        </div>

        <div>
          <label style={{ fontSize: 13, color: 'var(--text)', display: 'block', marginBottom: 4 }}>Max Steps</label>
          <Input
            type="number"
            value={form.guardrails.maxSteps?.toString() ?? ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : undefined
              setForm((f) => ({ ...f, guardrails: { ...f.guardrails, maxSteps: val } }))
            }}
            placeholder="No limit"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" variant="primary" loading={loading}>
          {isEdit ? 'Save Changes' : 'Create Skill'}
        </Button>
      </div>
    </form>
  )
}

export default SkillForm
