import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ColorPicker } from './ColorPicker'

describe('ColorPicker', () => {
  it('renders preset swatches as buttons', () => {
    render(<ColorPicker />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(10)
  })

  it('calls onChange when a swatch is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ColorPicker onChange={onChange} />)

    const swatch = screen.getByLabelText('Select color #EA580C')
    await user.click(swatch)
    expect(onChange).toHaveBeenCalledWith('#EA580C')
  })

  it('marks selected swatch with aria-pressed', () => {
    render(<ColorPicker value="#EA580C" />)
    expect(screen.getByLabelText('Select color #EA580C')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Select color #dc2626')).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders a label when provided', () => {
    render(<ColorPicker label="Brand Color" />)
    expect(screen.getByText('Brand Color')).toBeInTheDocument()
  })

  it('renders custom presets', () => {
    render(<ColorPicker presets={['#111111', '#222222']} />)
    expect(screen.getByLabelText('Select color #111111')).toBeInTheDocument()
    expect(screen.getByLabelText('Select color #222222')).toBeInTheDocument()
  })
})
