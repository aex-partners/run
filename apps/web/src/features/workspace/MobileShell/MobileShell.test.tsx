// apps/web/src/components/layout/MobileShell/MobileShell.test.tsx
import { describe, it, expect } from 'vitest'
import { sectionToTab, tabToSection } from './MobileShell'

describe('sectionToTab', () => {
  it('maps primary sections to their own tab', () => {
    expect(sectionToTab('chat')).toBe('chat')
    expect(sectionToTab('tasks')).toBe('tasks')
    expect(sectionToTab('mail')).toBe('mail')
    expect(sectionToTab('files')).toBe('files')
  })

  it('maps overflow sections to the "more" tab', () => {
    expect(sectionToTab('database')).toBe('more')
    expect(sectionToTab('knowledge')).toBe('more')
    expect(sectionToTab('workflows')).toBe('more')
    expect(sectionToTab('settings')).toBe('more')
  })
})

describe('tabToSection', () => {
  it('maps primary tabs to their section', () => {
    expect(tabToSection('chat')).toBe('chat')
    expect(tabToSection('tasks')).toBe('tasks')
    expect(tabToSection('mail')).toBe('mail')
    expect(tabToSection('files')).toBe('files')
  })

  it('returns null for the "more" tab (opens the sheet instead of navigating)', () => {
    expect(tabToSection('more')).toBeNull()
  })
})
