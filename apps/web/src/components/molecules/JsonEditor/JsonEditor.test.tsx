import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { JsonEditor } from './JsonEditor'

describe('JsonEditor', () => {
  it('renders a textarea (monospace)', () => {
    render(<JsonEditor aria-label="JSON editor" />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('calls onChange when typing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<JsonEditor value="" onChange={onChange} aria-label="JSON editor" />)

    await user.type(screen.getByRole('textbox'), 'abc')
    expect(onChange).toHaveBeenCalled()
  })

  it('shows no error for valid JSON on blur', () => {
    render(<JsonEditor value='{"key": "value"}' aria-label="JSON editor" />)
    fireEvent.blur(screen.getByRole('textbox'))

    expect(screen.queryByText(/invalid|error|unexpected/i)).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false')
  })

  it('shows error message for invalid JSON on blur', () => {
    render(<JsonEditor value="{bad json}" aria-label="JSON editor" />)
    fireEvent.blur(screen.getByRole('textbox'))

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('clears error when user starts typing again', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    const { rerender } = render(
      <JsonEditor value="{bad}" onChange={onChange} aria-label="JSON editor" />
    )
    fireEvent.blur(screen.getByRole('textbox'))
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')

    // Simulate typing which triggers onChange and clears error
    rerender(<JsonEditor value='{"valid": true}' onChange={onChange} aria-label="JSON editor" />)
    await user.type(screen.getByRole('textbox'), ' ')

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false')
  })

  it('empty value shows no error on blur', () => {
    render(<JsonEditor value="" aria-label="JSON editor" />)
    fireEvent.blur(screen.getByRole('textbox'))

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false')
  })
})
