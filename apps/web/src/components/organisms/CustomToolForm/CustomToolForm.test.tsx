import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CustomToolForm } from './CustomToolForm'

describe('CustomToolForm', () => {
  it('renders type selector with 4 options', () => {
    render(<CustomToolForm />)
    expect(screen.getByText('HTTP')).toBeInTheDocument()
    expect(screen.getByText('Query')).toBeInTheDocument()
    expect(screen.getByText('Code')).toBeInTheDocument()
    expect(screen.getByText('Composite')).toBeInTheDocument()
    expect(screen.getByText('Call an external REST API')).toBeInTheDocument()
    expect(screen.getByText('Execute a database query')).toBeInTheDocument()
    expect(screen.getByText('Run a JavaScript function')).toBeInTheDocument()
    expect(screen.getByText('Chain multiple tools')).toBeInTheDocument()
  })

  it('selects a type when clicked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<CustomToolForm onSubmit={onSubmit} />)

    await user.click(screen.getByText('Code'))
    await user.click(screen.getByRole('button', { name: 'Create Tool' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'code' })
    )
  })

  it('renders input schema and config JSON editors', () => {
    render(<CustomToolForm />)
    expect(screen.getByText('Input Schema (JSON)')).toBeInTheDocument()
    expect(screen.getByText('Configuration (JSON)')).toBeInTheDocument()
  })

  it('shows read-only toggle', () => {
    render(<CustomToolForm />)
    expect(screen.getByText('Read-only (safe to run without confirmation)')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('shows test panel when onTest is provided', () => {
    const onTest = vi.fn()
    render(<CustomToolForm onTest={onTest} />)
    expect(screen.getByText('Test Panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run Test' })).toBeInTheDocument()
  })

  it('does not show test panel when onTest is not provided', () => {
    render(<CustomToolForm />)
    expect(screen.queryByText('Test Panel')).not.toBeInTheDocument()
  })

  it('shows test result success when testResult is set', () => {
    const onTest = vi.fn()
    render(
      <CustomToolForm
        onTest={onTest}
        testResult={{ success: true, result: '{"status":"ok"}' }}
      />
    )
    expect(screen.getByText('{"status":"ok"}')).toBeInTheDocument()
  })

  it('shows test result error when testResult has error', () => {
    const onTest = vi.fn()
    render(
      <CustomToolForm
        onTest={onTest}
        testResult={{ success: false, error: 'Connection refused' }}
      />
    )
    expect(screen.getByText('Connection refused')).toBeInTheDocument()
  })

  it('calls onSubmit with form data', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<CustomToolForm onSubmit={onSubmit} />)

    await user.type(screen.getByPlaceholderText('e.g. get_orders (snake_case)'), 'fetch_users')
    await user.click(screen.getByRole('button', { name: 'Create Tool' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'fetch_users',
        type: 'http',
        isReadOnly: false,
      })
    )
  })
})
