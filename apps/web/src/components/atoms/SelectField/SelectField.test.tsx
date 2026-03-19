import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SelectField } from './SelectField'

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
]

describe('SelectField', () => {
  it('renders options', () => {
    render(<SelectField options={OPTIONS} />)
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<SelectField label="Country" options={OPTIONS} />)
    expect(screen.getByText('Country')).toBeInTheDocument()
  })

  it('calls onChange when selecting a value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SelectField options={OPTIONS} onChange={onChange} />)

    await user.selectOptions(screen.getByRole('combobox'), 'b')
    expect(onChange).toHaveBeenCalled()
  })

  it('shows error message with aria-invalid', () => {
    render(<SelectField options={OPTIONS} error="Required field" />)
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Required field')).toBeInTheDocument()
  })

  it('is disabled when disabled prop is set', () => {
    render(<SelectField options={OPTIONS} disabled />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('shows placeholder as disabled option', () => {
    render(<SelectField options={OPTIONS} placeholder="Pick one" />)
    expect(screen.getByText('Pick one')).toBeInTheDocument()
  })
})
