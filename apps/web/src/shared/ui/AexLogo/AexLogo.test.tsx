import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AexLogo } from './AexLogo'

describe('AexLogo', () => {
  it('renders an SVG with accessible label', () => {
    render(<AexLogo />)
    expect(screen.getByRole('img', { name: 'AEX Logo' })).toBeInTheDocument()
  })

  it('applies custom size', () => {
    render(<AexLogo size={48} />)
    const svg = screen.getByRole('img', { name: 'AEX Logo' })
    expect(svg).toHaveAttribute('height', '48')
  })
})
