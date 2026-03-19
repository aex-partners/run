import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StepIndicator } from './StepIndicator'

const STEPS = [
  { label: 'Account' },
  { label: 'Organization' },
  { label: 'Details' },
]

describe('StepIndicator', () => {
  it('renders all step labels', () => {
    render(<StepIndicator steps={STEPS} currentStep={0} />)
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Organization')).toBeInTheDocument()
    expect(screen.getByText('Details')).toBeInTheDocument()
  })

  it('marks the current step with aria-current', () => {
    render(<StepIndicator steps={STEPS} currentStep={1} />)
    const items = screen.getAllByRole('listitem')
    expect(items[1]).toHaveAttribute('aria-current', 'step')
    expect(items[0]).not.toHaveAttribute('aria-current')
  })

  it('renders a navigation landmark', () => {
    render(<StepIndicator steps={STEPS} currentStep={0} />)
    expect(screen.getByRole('navigation', { name: 'Setup progress' })).toBeInTheDocument()
  })

  it('shows step numbers for incomplete steps', () => {
    render(<StepIndicator steps={STEPS} currentStep={0} />)
    const items = screen.getAllByRole('listitem')
    expect(items[1]).toHaveTextContent('2')
    expect(items[2]).toHaveTextContent('3')
  })
})
