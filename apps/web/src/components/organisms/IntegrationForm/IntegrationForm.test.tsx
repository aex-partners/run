import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { IntegrationForm } from './IntegrationForm'

describe('IntegrationForm', () => {
  it('renders type selector with REST, OAuth2, and Webhook options', () => {
    render(<IntegrationForm />)
    expect(screen.getByText('REST API')).toBeInTheDocument()
    expect(screen.getByText('OAuth2')).toBeInTheDocument()
    expect(screen.getByText('Webhook')).toBeInTheDocument()
    expect(screen.getByText('API key or basic auth')).toBeInTheDocument()
    expect(screen.getByText('OAuth2 authorization flow')).toBeInTheDocument()
    expect(screen.getByText('Receive events via webhook')).toBeInTheDocument()
  })

  it('shows API Key and Base URL fields for REST type (default)', () => {
    render(<IntegrationForm />)
    // REST is default type
    expect(screen.getByText('API Key')).toBeInTheDocument()
    expect(screen.getByText('Base URL')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('https://api.example.com')).toBeInTheDocument()
  })

  it('shows Client ID, Client Secret, Auth URL, Token URL for OAuth2', async () => {
    const user = userEvent.setup()
    render(<IntegrationForm />)

    await user.click(screen.getByText('OAuth2'))

    expect(screen.getByText('Client ID')).toBeInTheDocument()
    expect(screen.getByText('Client Secret')).toBeInTheDocument()
    expect(screen.getByText('Authorization URL')).toBeInTheDocument()
    expect(screen.getByText('Token URL')).toBeInTheDocument()
  })

  it('shows webhook secret field for Webhook type', async () => {
    const user = userEvent.setup()
    render(<IntegrationForm />)

    await user.click(screen.getByText('Webhook'))

    expect(screen.getByText('Webhook Secret')).toBeInTheDocument()
  })

  it('shows OAuth connect button when type is oauth2 and onOAuthConnect provided', async () => {
    const user = userEvent.setup()
    const onOAuthConnect = vi.fn()
    render(<IntegrationForm onOAuthConnect={onOAuthConnect} />)

    await user.click(screen.getByText('OAuth2'))

    expect(screen.getByRole('button', { name: /Connect with OAuth2/i })).toBeInTheDocument()
  })

  it('does not show OAuth connect button when onOAuthConnect is not provided', async () => {
    const user = userEvent.setup()
    render(<IntegrationForm />)

    await user.click(screen.getByText('OAuth2'))

    expect(screen.queryByRole('button', { name: /Connect with OAuth2/i })).not.toBeInTheDocument()
  })

  it('calls onSubmit with correct data for REST type', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<IntegrationForm onSubmit={onSubmit} />)

    await user.type(screen.getByPlaceholderText('e.g. WhatsApp Business'), 'My API')
    await user.click(screen.getByRole('button', { name: 'Create Integration' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My API',
        type: 'rest',
        credentials: expect.any(Object),
      })
    )
  })
})
