import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ForgotPasswordPage } from './ForgotPasswordPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  )
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the email form with a back-to-login link', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Reset password' })).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to login' })).toBeInTheDocument()
  })

  it('posts the email to request-password-reset and shows the neutral confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send link' }))

    await waitFor(() => {
      expect(screen.getByText(/we've sent a link to reset your password/i)).toBeInTheDocument()
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/auth/request-password-reset')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.email).toBe('user@example.com')
    expect(body.redirectTo).toContain('/reset-password')
  })

  it('shows an error when the request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, json: () => Promise.resolve({ message: 'Boom' }) })
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send link' }))

    await waitFor(() => {
      expect(screen.getByText('Boom')).toBeInTheDocument()
    })
  })
})
