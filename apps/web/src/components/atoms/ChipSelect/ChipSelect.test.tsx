import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ShoppingBag } from 'lucide-react'
import { ChipSelect } from './ChipSelect'

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
]

describe('ChipSelect', () => {
  it('renders all options', () => {
    render(<ChipSelect options={options} value="" onChange={() => {}} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('selects an option on click (single mode)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ChipSelect options={options} value="" onChange={onChange} />)

    await user.click(screen.getByText('Beta'))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('deselects and selects new option in single mode', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ChipSelect options={options} value="a" onChange={onChange} />)

    await user.click(screen.getByText('Gamma'))
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('toggles options in multiple mode', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <ChipSelect options={options} value={['a']} onChange={onChange} multiple />
    )

    await user.click(screen.getByText('Beta'))
    expect(onChange).toHaveBeenCalledWith(['a', 'b'])

    onChange.mockClear()
    await user.click(screen.getByText('Alpha'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('renders label when provided', () => {
    render(
      <ChipSelect options={options} value="" onChange={() => {}} label="Pick one" />
    )
    expect(screen.getByText('Pick one')).toBeInTheDocument()
  })

  it('shows error message', () => {
    render(
      <ChipSelect
        options={options}
        value=""
        onChange={() => {}}
        error="Required field"
      />
    )
    expect(screen.getByText('Required field')).toBeInTheDocument()
  })

  it('renders icons when provided', () => {
    const optionsWithIcon = [
      { value: 'shop', label: 'Shop', icon: <ShoppingBag data-testid="icon-shop" size={14} /> },
    ]
    render(<ChipSelect options={optionsWithIcon} value="" onChange={() => {}} />)
    expect(screen.getByTestId('icon-shop')).toBeInTheDocument()
  })
})
