import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SkillForm } from './SkillForm'

describe('SkillForm', () => {
  it('renders all form fields', () => {
    render(<SkillForm />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('System Prompt')).toBeInTheDocument()
    expect(screen.getByText('Custom Tools')).toBeInTheDocument()
    expect(screen.getByText('System Tools')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Order Management')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('What does this skill enable?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Instructions for this skill...')).toBeInTheDocument()
  })

  it('shows guardrails section with require confirmation toggle and max steps input', () => {
    render(<SkillForm />)
    expect(screen.getByText('Guardrails')).toBeInTheDocument()
    expect(screen.getByText('Require Confirmation')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
    expect(screen.getByText('Max Steps')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('No limit')).toBeInTheDocument()
  })

  it('shows "Create Skill" when no initialData', () => {
    render(<SkillForm />)
    expect(screen.getByRole('button', { name: 'Create Skill' })).toBeInTheDocument()
  })

  it('shows "Save Changes" when initialData.name is set', () => {
    render(<SkillForm initialData={{ name: 'Order Skill' }} />)
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })

  it('calls onSubmit with data including guardrails', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<SkillForm onSubmit={onSubmit} />)

    await user.type(screen.getByPlaceholderText('e.g. Order Management'), 'My Skill')
    await user.type(screen.getByPlaceholderText('What does this skill enable?'), 'Manages orders')
    await user.type(screen.getByPlaceholderText('Instructions for this skill...'), 'Handle order flows')

    // Toggle require confirmation
    await user.click(screen.getByRole('switch'))

    // Set max steps
    await user.type(screen.getByPlaceholderText('No limit'), '10')

    await user.click(screen.getByRole('button', { name: 'Create Skill' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Skill',
        description: 'Manages orders',
        systemPrompt: 'Handle order flows',
        guardrails: expect.objectContaining({
          requireConfirmation: true,
          maxSteps: 10,
        }),
      })
    )
  })
})
