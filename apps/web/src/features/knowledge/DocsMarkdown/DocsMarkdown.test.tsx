import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocsMarkdown } from './DocsMarkdown'

describe('DocsMarkdown', () => {
  it('calls onNavigate with slug for a relative .md link', async () => {
    const onNavigate = vi.fn()
    render(<DocsMarkdown markdown={'[go](./your-data.md)'} onNavigate={onNavigate} />)
    await userEvent.click(screen.getByText('go'))
    expect(onNavigate).toHaveBeenCalledWith('your-data', undefined)
  })

  it('calls onNavigate with slug and anchor for a .md link with hash', async () => {
    const onNavigate = vi.fn()
    render(<DocsMarkdown markdown={'[go](./your-data.md#section-x)'} onNavigate={onNavigate} />)
    await userEvent.click(screen.getByText('go'))
    expect(onNavigate).toHaveBeenCalledWith('your-data', 'section-x')
  })

  it('does not call onNavigate for a pure anchor link', async () => {
    const onNavigate = vi.fn()
    render(<DocsMarkdown markdown={'[here](#intro)'} onNavigate={onNavigate} />)
    await userEvent.click(screen.getByText('here'))
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('renders external links with target _blank and does not navigate', async () => {
    const onNavigate = vi.fn()
    render(<DocsMarkdown markdown={'[site](https://example.com)'} onNavigate={onNavigate} />)
    const link = screen.getByText('site').closest('a') as HTMLAnchorElement
    expect(link.target).toBe('_blank')
    expect(link.rel).toContain('noopener')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('gives headings a slug id (keeps accents)', () => {
    render(<DocsMarkdown markdown={'## Conectando serviços externos'} onNavigate={() => {}} />)
    expect(document.getElementById('conectando-serviços-externos')).not.toBeNull()
  })
})
