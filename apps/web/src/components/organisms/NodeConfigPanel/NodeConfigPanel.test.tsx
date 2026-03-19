import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { NodeConfigPanel } from './NodeConfigPanel'

describe('NodeConfigPanel', () => {
  const defaultProps = {
    nodeId: 'node-1',
    nodeLabel: 'Process Order',
    toolOptions: [
      { value: 'get_orders', label: 'Get Orders' },
      { value: 'create_invoice', label: 'Create Invoice' },
    ],
    agentOptions: [
      { value: 'agent-1', label: 'Sales Agent' },
      { value: 'agent-2', label: 'Support Agent' },
    ],
  }

  it('renders with node label', () => {
    render(<NodeConfigPanel {...defaultProps} />)
    expect(screen.getByText('Node Config')).toBeInTheDocument()
    expect(screen.getByText('Process Order')).toBeInTheDocument()
  })

  it('shows inference/structured type selectors', () => {
    render(<NodeConfigPanel {...defaultProps} />)
    expect(screen.getByText('Inference')).toBeInTheDocument()
    expect(screen.getByText('Structured')).toBeInTheDocument()
  })

  it('shows tool dropdown only when structured is selected', async () => {
    const user = userEvent.setup()
    render(<NodeConfigPanel {...defaultProps} />)

    // Inference is default, tool dropdown should not be present
    expect(screen.queryByText('Tool')).not.toBeInTheDocument()

    // Click "Structured"
    await user.click(screen.getByText('Structured'))

    expect(screen.getByText('Tool')).toBeInTheDocument()
    expect(screen.getByText('Select tool...')).toBeInTheDocument()
  })

  it('shows agent dropdown', () => {
    render(<NodeConfigPanel {...defaultProps} />)
    expect(screen.getByText('Agent')).toBeInTheDocument()
    expect(screen.getByText('Default agent')).toBeInTheDocument()
  })

  it('shows tool input JSON editor only when structured', async () => {
    const user = userEvent.setup()
    render(<NodeConfigPanel {...defaultProps} />)

    // Not visible by default (inference mode)
    expect(screen.queryByText('Tool Input (JSON)')).not.toBeInTheDocument()

    await user.click(screen.getByText('Structured'))

    expect(screen.getByText('Tool Input (JSON)')).toBeInTheDocument()
  })

  it('calls onSave with correct config data', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<NodeConfigPanel {...defaultProps} onSave={onSave} />)

    // Select structured type
    await user.click(screen.getByText('Structured'))

    // Select a tool from the dropdown
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'get_orders' } })

    // Select an agent
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'agent-1' } })

    // Click save
    await user.click(screen.getByRole('button', { name: 'Save Config' }))

    expect(onSave).toHaveBeenCalledWith(
      'node-1',
      expect.objectContaining({
        taskType: 'structured',
        toolName: 'get_orders',
        agentId: 'agent-1',
      })
    )
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<NodeConfigPanel {...defaultProps} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
