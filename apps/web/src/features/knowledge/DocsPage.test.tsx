import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../../platform/i18n/i18n'
import { DocsPage } from './DocsPage'
import { getDocsManifest, getDocPage } from '../workspace/data/docsContent'

const manifest = getDocsManifest()

beforeEach(() => {
  // jsdom lacks scrollIntoView.
  Element.prototype.scrollIntoView = () => {}
  // Pin language so the default-render assertion is deterministic. The test
  // setup (src/test/setup.ts) already initializes lng: 'en'; this guards
  // against another test having switched it.
  i18n.changeLanguage('en')
})

describe('DocsPage', () => {
  it('renders the first page by default', () => {
    render(<DocsPage />)
    const first = getDocPage(manifest[0].slug, 'en') as string
    const h1 = first.match(/^#\s+(.+)$/m)?.[1] as string
    expect(screen.getByRole('heading', { level: 1, name: h1 })).toBeTruthy()
  })

  it('switches the rendered page when a nav item is clicked', async () => {
    render(<DocsPage />)
    const target = manifest[2] // your-data
    await userEvent.click(screen.getByRole('button', { name: target.title.en }))
    const page = getDocPage(target.slug, 'en') as string
    const h1 = page.match(/^#\s+(.+)$/m)?.[1] as string
    expect(screen.getByRole('heading', { level: 1, name: h1 })).toBeTruthy()
  })

  it('re-renders the active page in the other language via the toggle', async () => {
    render(<DocsPage />)
    await userEvent.click(screen.getByRole('button', { name: 'PT' }))
    const page = getDocPage(manifest[0].slug, 'pt-BR') as string
    const h1 = page.match(/^#\s+(.+)$/m)?.[1] as string
    expect(screen.getByRole('heading', { level: 1, name: h1 })).toBeTruthy()
  })
})
