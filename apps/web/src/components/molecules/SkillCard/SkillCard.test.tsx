import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SkillCard } from './SkillCard'

const defaultProps = {
  id: 'skill-1',
  name: 'Data Analysis',
  description: 'Analyzes datasets and generates reports',
  toolCount: 4,
}

describe('SkillCard', () => {
  it('renders skill name and description', () => {
    render(<SkillCard {...defaultProps} />)
    expect(screen.getByText('Data Analysis')).toBeInTheDocument()
    expect(screen.getByText('Analyzes datasets and generates reports')).toBeInTheDocument()
  })

  it('shows tool count badge', () => {
    render(<SkillCard {...defaultProps} />)
    expect(screen.getByText('4 tools')).toBeInTheDocument()
  })

  it('shows guardrails badge when hasGuardrails is true', () => {
    render(<SkillCard {...defaultProps} hasGuardrails />)
    expect(screen.getByText('Guardrails')).toBeInTheDocument()
  })

  it('does not show guardrails badge when hasGuardrails is false', () => {
    render(<SkillCard {...defaultProps} hasGuardrails={false} />)
    expect(screen.queryByText('Guardrails')).not.toBeInTheDocument()
  })

  it('calls onEdit on hover action', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const { container } = render(
      <SkillCard {...defaultProps} onEdit={onEdit} />
    )

    fireEvent.mouseEnter(container.firstChild as Element)
    await user.click(screen.getByLabelText('Edit Data Analysis'))
    expect(onEdit).toHaveBeenCalledWith('skill-1')
  })

  it('calls onDelete on hover action', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const { container } = render(
      <SkillCard {...defaultProps} onDelete={onDelete} />
    )

    fireEvent.mouseEnter(container.firstChild as Element)
    await user.click(screen.getByLabelText('Delete Data Analysis'))
    expect(onDelete).toHaveBeenCalledWith('skill-1')
  })
})
