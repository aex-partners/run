import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TaskCard } from './TaskCard'

const baseProps = {
  id: 'task-1',
  title: 'Process Order #1234',
  status: 'running' as const,
  agent: 'Sales Agent',
  startTime: '14:30',
}

describe('TaskCard - taskType and toolName features', () => {
  it('renders taskType badge when taskType="inference"', () => {
    render(<TaskCard {...baseProps} taskType="inference" />)
    expect(screen.getByText('Inference')).toBeInTheDocument()
  })

  it('renders taskType badge when taskType="structured"', () => {
    render(<TaskCard {...baseProps} taskType="structured" />)
    expect(screen.getByText('Structured')).toBeInTheDocument()
  })

  it('renders toolName in monospace when provided', () => {
    render(<TaskCard {...baseProps} toolName="get_orders" />)
    expect(screen.getByText('get_orders')).toBeInTheDocument()
  })

  it('does not render taskType badge when not provided', () => {
    render(<TaskCard {...baseProps} />)
    expect(screen.queryByText('Inference')).not.toBeInTheDocument()
    expect(screen.queryByText('Structured')).not.toBeInTheDocument()
  })

  it('does not render toolName when not provided', () => {
    render(<TaskCard {...baseProps} />)
    expect(screen.queryByText('get_orders')).not.toBeInTheDocument()
  })

  it('shows both taskType and toolName together', () => {
    render(<TaskCard {...baseProps} taskType="structured" toolName="create_invoice" />)
    expect(screen.getByText('Structured')).toBeInTheDocument()
    expect(screen.getByText('create_invoice')).toBeInTheDocument()
  })
})
