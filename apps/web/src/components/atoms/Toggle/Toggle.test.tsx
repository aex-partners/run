import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Toggle } from './Toggle'

describe('Toggle', () => {
  it('renders as a switch role', () => {
    render(<Toggle aria-label="Test toggle" />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('calls onChange when clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} aria-label="Test toggle" />)

    await user.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('shows checked state via aria-checked', () => {
    const { rerender } = render(<Toggle checked={false} aria-label="Test toggle" />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')

    rerender(<Toggle checked={true} aria-label="Test toggle" />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('disabled toggle does not call onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Toggle disabled onChange={onChange} aria-label="Test toggle" />)

    await user.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('small size renders without error', () => {
    render(<Toggle size="sm" aria-label="Small toggle" />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })
})
