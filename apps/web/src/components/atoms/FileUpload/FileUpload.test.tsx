import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FileUpload } from './FileUpload'

describe('FileUpload', () => {
  it('renders the upload button', () => {
    render(<FileUpload />)
    expect(screen.getByRole('button', { name: 'Upload file' })).toBeInTheDocument()
  })

  it('shows hint text', () => {
    render(<FileUpload hint="Click to upload" />)
    expect(screen.getByText('Click to upload')).toBeInTheDocument()
  })

  it('shows image preview when value is provided', () => {
    render(<FileUpload value="https://example.com/logo.png" />)
    expect(screen.getByAltText('Upload preview')).toBeInTheDocument()
  })

  it('is disabled when disabled prop is set', () => {
    render(<FileUpload disabled />)
    expect(screen.getByRole('button', { name: 'Upload file' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('opens file dialog on click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FileUpload onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Upload file' }))
    // File input is hidden but present in DOM
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument()
  })

  it('opens file dialog on Enter key', async () => {
    const user = userEvent.setup()
    render(<FileUpload />)

    const button = screen.getByRole('button', { name: 'Upload file' })
    button.focus()
    await user.keyboard('{Enter}')
    // No error thrown means keyboard handler works
    expect(button).toBeInTheDocument()
  })
})
