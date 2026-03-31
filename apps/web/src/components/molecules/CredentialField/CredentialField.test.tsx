import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { CredentialField } from './CredentialField'

describe('CredentialField', () => {
  it('renders with password type by default (masked)', () => {
    render(<CredentialField value="secret123" />)
    const input = screen.getByPlaceholderText('Enter secret...')
    expect(input).toHaveAttribute('type', 'password')
  })

  it('shows label when provided', () => {
    render(<CredentialField label="API Key" />)
    expect(screen.getByText('API Key')).toBeInTheDocument()
  })

  it('toggles to text type when clicking reveal button', async () => {
    const user = userEvent.setup()
    render(<CredentialField value="secret123" />)

    await user.click(screen.getByLabelText('Reveal value'))
    expect(screen.getByPlaceholderText('Enter secret...')).toHaveAttribute('type', 'text')
  })

  it('toggles back to password when clicking hide', async () => {
    const user = userEvent.setup()
    render(<CredentialField value="secret123" />)

    await user.click(screen.getByLabelText('Reveal value'))
    expect(screen.getByPlaceholderText('Enter secret...')).toHaveAttribute('type', 'text')

    await user.click(screen.getByLabelText('Hide value'))
    expect(screen.getByPlaceholderText('Enter secret...')).toHaveAttribute('type', 'password')
  })

  it('disabled state', () => {
    render(<CredentialField disabled />)
    expect(screen.getByPlaceholderText('Enter secret...')).toBeDisabled()
  })
})
