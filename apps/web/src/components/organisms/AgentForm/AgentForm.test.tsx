import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { AgentForm } from './AgentForm'

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

describe('AgentForm', () => {
  it('renders all form fields', () => {
    render(<AgentForm />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('System Prompt')).toBeInTheDocument()
    expect(screen.getByText('Model ID')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Sales Agent')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('What does this agent do?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('You are an AI assistant that...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. gpt-4o (leave empty for default)')).toBeInTheDocument()
  })

  it('shows "Create Agent" button when no initialData', () => {
    render(<AgentForm />)
    expect(screen.getByRole('button', { name: 'Create Agent' })).toBeInTheDocument()
  })

  it('shows "Save Changes" button when initialData.name is set', () => {
    render(<AgentForm initialData={{ name: 'Test Agent' }} />)
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })

  it('calls onSubmit with form data when submitted', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AgentForm onSubmit={onSubmit} />)

    await user.type(screen.getByPlaceholderText('e.g. Sales Agent'), 'My Agent')
    await user.type(screen.getByPlaceholderText('What does this agent do?'), 'A description')
    await user.type(screen.getByPlaceholderText('You are an AI assistant that...'), 'You are helpful')
    await user.type(screen.getByPlaceholderText('e.g. gpt-4o (leave empty for default)'), 'gpt-4o')

    await user.click(screen.getByRole('button', { name: 'Create Agent' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Agent',
        description: 'A description',
        systemPrompt: 'You are helpful',
        modelId: 'gpt-4o',
        skillIds: [],
        toolIds: [],
      })
    )
  })

  it('calls onCancel when cancel clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<AgentForm onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('renders skill and tool MultiSelects', () => {
    render(
      <AgentForm
        skillOptions={[{ value: 's1', label: 'Order Skill' }]}
        toolOptions={[{ value: 't1', label: 'HTTP Tool' }]}
      />
    )
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Tools')).toBeInTheDocument()
    expect(screen.getByText('Select skills...')).toBeInTheDocument()
    expect(screen.getByText('Select tools...')).toBeInTheDocument()
  })
})
