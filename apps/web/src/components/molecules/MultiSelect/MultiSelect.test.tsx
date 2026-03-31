import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { MultiSelect } from './MultiSelect'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Charlie' },
]

describe('MultiSelect', () => {
  it('renders with placeholder when no items selected', () => {
    render(<MultiSelect options={options} selected={[]} placeholder="Pick items" />)
    expect(screen.getByText('Pick items')).toBeInTheDocument()
  })

  it('shows selected items as pills', () => {
    render(<MultiSelect options={options} selected={['a', 'c']} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  it('opens dropdown on click', async () => {
    const user = userEvent.setup()
    render(<MultiSelect options={options} selected={[]} />)

    await user.click(screen.getByText('Select...'))
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('filters options by search text', async () => {
    const user = userEvent.setup()
    render(<MultiSelect options={options} selected={[]} />)

    await user.click(screen.getByText('Select...'))
    await user.type(screen.getByPlaceholderText('Search...'), 'alp')

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument()
  })

  it('toggles selection when clicking an option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MultiSelect options={options} selected={[]} onChange={onChange} />)

    await user.click(screen.getByText('Select...'))
    await user.click(screen.getByText('Beta'))

    expect(onChange).toHaveBeenCalledWith(['b'])
  })

  it('removes item when clicking X on pill', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MultiSelect options={options} selected={['a', 'b']} onChange={onChange} />)

    await user.click(screen.getByLabelText('Remove Alpha'))
    expect(onChange).toHaveBeenCalledWith(['b'])
  })

  it('disabled state prevents opening', async () => {
    const user = userEvent.setup()
    render(<MultiSelect options={options} selected={[]} disabled />)

    await user.click(screen.getByText('Select...'))
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  it('shows "No options found" when search has no matches', async () => {
    const user = userEvent.setup()
    render(<MultiSelect options={options} selected={[]} />)

    await user.click(screen.getByText('Select...'))
    await user.type(screen.getByPlaceholderText('Search...'), 'zzzzz')

    expect(screen.getByText('No options found')).toBeInTheDocument()
  })
})
