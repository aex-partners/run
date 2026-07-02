import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AgentCard } from './AgentCard'

const defaultProps = {
  id: 'agent-1',
  name: 'Sales Agent',
  description: 'Handles sales operations',
  skillCount: 3,
  toolCount: 5,
}

describe('AgentCard', () => {
  it('renders agent name', () => {
    render(<AgentCard {...defaultProps} />)
    expect(screen.getByText('Sales Agent')).toBeInTheDocument()
  })

  it('renders description', () => {
    render(<AgentCard {...defaultProps} />)
    expect(screen.getByText('Handles sales operations')).toBeInTheDocument()
  })

  it('shows skill count badge', () => {
    render(<AgentCard {...defaultProps} />)
    expect(screen.getByText('3 skills')).toBeInTheDocument()
  })

  it('shows tool count badge', () => {
    render(<AgentCard {...defaultProps} />)
    expect(screen.getByText('5 tools')).toBeInTheDocument()
  })

  it('edit/delete buttons are visible when handlers provided', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(
      <AgentCard {...defaultProps} onEdit={onEdit} onDelete={onDelete} />
    )

    // Buttons always visible when handlers are provided
    expect(screen.getByLabelText('Edit Sales Agent')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete Sales Agent')).toBeInTheDocument()
  })

  it('calls onEdit with correct id', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(
      <AgentCard {...defaultProps} onEdit={onEdit} />
    )

    await user.click(screen.getByLabelText('Edit Sales Agent'))
    expect(onEdit).toHaveBeenCalledWith('agent-1')
  })

  it('calls onDelete with correct id', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <AgentCard {...defaultProps} onDelete={onDelete} />
    )

    await user.click(screen.getByLabelText('Delete Sales Agent'))
    expect(onDelete).toHaveBeenCalledWith('agent-1')
  })
})
