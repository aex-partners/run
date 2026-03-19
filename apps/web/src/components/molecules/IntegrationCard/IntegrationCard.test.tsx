import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { IntegrationCard } from './IntegrationCard'

const defaultProps = {
  id: 'int-1',
  name: 'Slack',
  description: 'Slack workspace integration',
  type: 'oauth2' as const,
  enabled: true,
}

describe('IntegrationCard', () => {
  it('renders integration name and description', () => {
    render(<IntegrationCard {...defaultProps} />)
    expect(screen.getByText('Slack')).toBeInTheDocument()
    expect(screen.getByText('Slack workspace integration')).toBeInTheDocument()
  })

  it('shows type badge', () => {
    render(<IntegrationCard {...defaultProps} type="oauth2" />)
    expect(screen.getByText('OAuth2')).toBeInTheDocument()
  })

  it('shows enabled status badge', () => {
    render(<IntegrationCard {...defaultProps} enabled={true} />)
    expect(screen.getByText('Enabled')).toBeInTheDocument()
  })

  it('shows disabled status badge', () => {
    render(<IntegrationCard {...defaultProps} enabled={false} />)
    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })

  it('toggle calls onToggle with correct id and boolean', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<IntegrationCard {...defaultProps} enabled={true} onToggle={onToggle} />)

    await user.click(screen.getByLabelText('Toggle Slack'))
    expect(onToggle).toHaveBeenCalledWith('int-1', false)
  })

  it('configure button calls onConfigure', async () => {
    const user = userEvent.setup()
    const onConfigure = vi.fn()
    render(<IntegrationCard {...defaultProps} onConfigure={onConfigure} />)

    await user.click(screen.getByLabelText('Configure Slack'))
    expect(onConfigure).toHaveBeenCalledWith('int-1')
  })
})
