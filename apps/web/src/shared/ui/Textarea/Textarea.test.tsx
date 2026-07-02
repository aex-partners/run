import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Textarea } from './Textarea'

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea aria-label="Test textarea" />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('accepts text input', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Textarea onChange={onChange} aria-label="Test textarea" />)

    await user.type(screen.getByRole('textbox'), 'hello')
    expect(onChange).toHaveBeenCalled()
  })

  it('shows error message when error prop is set', () => {
    render(<Textarea error="This field is required" aria-label="Test textarea" />)
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('disabled state', () => {
    render(<Textarea disabled aria-label="Test textarea" />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('monospace mode renders without error', () => {
    render(<Textarea monospace aria-label="Monospace textarea" />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('aria-invalid when error prop is set', () => {
    render(<Textarea error="Invalid input" aria-label="Test textarea" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })
})
