import React, { useState } from 'react'
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
  internetAccess: boolean
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
  const [form, setForm] = useState<AgentFormData>({
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    systemPrompt: initialData?.systemPrompt ?? '',
    modelId: initialData?.modelId ?? '',
    skillIds: initialData?.skillIds ?? [],
    toolIds: initialData?.toolIds ?? [],
    internetAccess: initialData?.internetAccess ?? false,
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
          placeholder="e.g. Sales Agent"
        />
      </div>

      <div>
        <label style={labelStyle}>Description</label>
        <Input
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="What does this agent do?"
        />
      </div>

      <div>
        <label style={labelStyle}>System Prompt</label>
        <Textarea
          value={form.systemPrompt}
          onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
          placeholder="You are an AI assistant that..."
          rows={5}
        />
      </div>

      <div>
        <label style={labelStyle}>Model ID</label>
        <Input
          value={form.modelId}
          onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
          placeholder="e.g. gpt-4o (leave empty for default)"
        />
      </div>

      <div>
        <label style={labelStyle}>Skills</label>
        <MultiSelect
          options={skillOptions}
          selected={form.skillIds}
          onChange={(skillIds) => setForm((f) => ({ ...f, skillIds }))}
          placeholder="Select skills..."
        />
      </div>

      <div>
        <label style={labelStyle}>Tools</label>
        <MultiSelect
          options={toolOptions}
          selected={form.toolIds}
          onChange={(toolIds) => setForm((f) => ({ ...f, toolIds }))}
          placeholder="Select tools..."
        />
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        background: 'var(--surface-2)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        <div>
          <label style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }}>Internet Access</label>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Allow this agent to search the web and fetch URLs.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.internetAccess}
          onClick={() => setForm((f) => ({ ...f, internetAccess: !f.internetAccess }))}
          style={{
            width: 40,
            height: 22,
            borderRadius: 11,
            border: 'none',
            background: form.internetAccess ? 'var(--accent)' : 'var(--border)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute',
            top: 2,
            left: form.internetAccess ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" variant="primary" loading={loading}>
          {isEdit ? 'Save Changes' : 'Create Agent'}
        </Button>
      </div>
    </form>
  )
}

export default AgentForm
