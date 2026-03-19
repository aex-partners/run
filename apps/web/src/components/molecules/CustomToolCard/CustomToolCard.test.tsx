import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CustomToolCard } from './CustomToolCard'

const defaultProps = {
  id: 'tool-1',
  name: 'fetch_orders',
  description: 'Fetches orders from the API',
  type: 'http' as const,
}

describe('CustomToolCard', () => {
  it('renders tool name in monospace style', () => {
    render(<CustomToolCard {...defaultProps} />)
    expect(screen.getByText('fetch_orders')).toBeInTheDocument()
  })

  it('shows type badge (HTTP)', () => {
    render(<CustomToolCard {...defaultProps} type="http" />)
    expect(screen.getByText('HTTP')).toBeInTheDocument()
  })

  it('shows type badge (Code)', () => {
    render(<CustomToolCard {...defaultProps} type="code" />)
    expect(screen.getByText('Code')).toBeInTheDocument()
  })

  it('shows type badge (Query)', () => {
    render(<CustomToolCard {...defaultProps} type="query" />)
    expect(screen.getByText('Query')).toBeInTheDocument()
  })

  it('shows type badge (Composite)', () => {
    render(<CustomToolCard {...defaultProps} type="composite" />)
    expect(screen.getByText('Composite')).toBeInTheDocument()
  })

  it('shows integration name badge when provided', () => {
    render(<CustomToolCard {...defaultProps} integrationName="Stripe" />)
    expect(screen.getByText('Stripe')).toBeInTheDocument()
  })

  it('calls onTest on hover action', async () => {
    const user = userEvent.setup()
    const onTest = vi.fn()
    const { container } = render(
      <CustomToolCard {...defaultProps} onTest={onTest} />
    )

    fireEvent.mouseEnter(container.firstChild as Element)
    await user.click(screen.getByLabelText('Test fetch_orders'))
    expect(onTest).toHaveBeenCalledWith('tool-1')
  })

  it('calls onEdit on hover action', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const { container } = render(
      <CustomToolCard {...defaultProps} onEdit={onEdit} />
    )

    fireEvent.mouseEnter(container.firstChild as Element)
    await user.click(screen.getByLabelText('Edit fetch_orders'))
    expect(onEdit).toHaveBeenCalledWith('tool-1')
  })

  it('calls onDelete on hover action', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const { container } = render(
      <CustomToolCard {...defaultProps} onDelete={onDelete} />
    )

    fireEvent.mouseEnter(container.firstChild as Element)
    await user.click(screen.getByLabelText('Delete fetch_orders'))
    expect(onDelete).toHaveBeenCalledWith('tool-1')
  })
})
