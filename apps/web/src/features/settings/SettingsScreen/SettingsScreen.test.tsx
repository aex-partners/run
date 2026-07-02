import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { SettingsScreen } from './SettingsScreen'

// Radix ScrollArea requires ResizeObserver
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const minProps = {
  users: [],
  installedPlugins: [],
  marketplacePlugins: [],
}

describe('SettingsScreen', () => {
  it('renders sidebar with all nav items', () => {
    render(<SettingsScreen {...minProps} />)
    // Nav items are inside the sidebar. Use getAllByText for items that may appear in both nav and content.
    const sidebar = screen.getByText('Settings').closest('aside')!
    expect(within(sidebar).getByText('Users')).toBeInTheDocument()
    expect(within(sidebar).getByText('Agents')).toBeInTheDocument()
    expect(within(sidebar).getByText('Skills')).toBeInTheDocument()
    expect(within(sidebar).getByText('Tools')).toBeInTheDocument()
    expect(within(sidebar).getByText('Plugins')).toBeInTheDocument()
    expect(within(sidebar).getByText('Company')).toBeInTheDocument()
  })

  it('clicking "Agents" nav shows agents section', async () => {
    const user = userEvent.setup()
    render(
      <SettingsScreen
        {...minProps}
        agents={[
          { id: 'a1', name: 'Sales Agent', description: 'Handles sales', skillCount: 2, toolCount: 3 },
        ]}
        onCreateAgent={vi.fn()}
      />
    )

    const sidebar = screen.getByText('Settings').closest('aside')!
    await user.click(within(sidebar).getByText('Agents'))

    expect(screen.getByRole('heading', { name: 'Agents' })).toBeInTheDocument()
    expect(screen.getByText('Sales Agent')).toBeInTheDocument()
  })

  it('agents section shows "New" button that opens dialog', async () => {
    const user = userEvent.setup()
    const onCreateAgent = vi.fn()
    render(
      <SettingsScreen
        {...minProps}
        agents={[]}
        onCreateAgent={onCreateAgent}
      />
    )

    const sidebar = screen.getByText('Settings').closest('aside')!
    await user.click(within(sidebar).getByText('Agents'))
    await user.click(screen.getByRole('button', { name: /New/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New Agent')).toBeInTheDocument()
  })

  it('clicking "Skills" nav shows skills section with skill cards', async () => {
    const user = userEvent.setup()
    render(
      <SettingsScreen
        {...minProps}
        skills={[
          { id: 's1', name: 'Order Management', description: 'Manages orders', toolCount: 4, hasGuardrails: true },
        ]}
        onCreateSkill={vi.fn()}
      />
    )

    const sidebar = screen.getByText('Settings').closest('aside')!
    await user.click(within(sidebar).getByText('Skills'))

    expect(screen.getByRole('heading', { name: 'Skills' })).toBeInTheDocument()
    expect(screen.getByText('Order Management')).toBeInTheDocument()
  })

  it('clicking "Tools" nav shows tools section with piece tools', async () => {
    const user = userEvent.setup()
    render(
      <SettingsScreen
        {...minProps}
        pieceTools={[
          { name: 'get_orders', displayName: 'Get Orders', description: 'Fetch orders', pluginName: 'Shop' },
        ]}
      />
    )

    const sidebar = screen.getByText('Settings').closest('aside')!
    await user.click(within(sidebar).getByText('Tools'))

    expect(screen.getByRole('heading', { name: 'Plugin Tools' })).toBeInTheDocument()
    expect(screen.getByText('Get Orders')).toBeInTheDocument()
  })

  it('clicking "Plugins" nav shows plugins section', async () => {
    const user = userEvent.setup()
    render(
      <SettingsScreen
        {...minProps}
        installedPlugins={[
          { name: 'WhatsApp', description: 'WA Business', installed: true, icon: null },
        ]}
      />
    )

    const sidebar = screen.getByText('Settings').closest('aside')!
    await user.click(within(sidebar).getByText('Plugins'))

    // The heading uses settings.plugins which is "Plugins"
    expect(screen.getByRole('heading', { name: 'Plugins' })).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
  })

  it('empty states show correct messages', async () => {
    const user = userEvent.setup()
    render(
      <SettingsScreen
        {...minProps}
        agents={[]}
        skills={[]}
        onCreateAgent={vi.fn()}
        onCreateSkill={vi.fn()}
      />
    )

    const sidebar = screen.getByText('Settings').closest('aside')!

    await user.click(within(sidebar).getByText('Agents'))
    expect(screen.getByText('No agents created yet.')).toBeInTheDocument()

    await user.click(within(sidebar).getByText('Skills'))
    expect(screen.getByText('No skills created yet.')).toBeInTheDocument()

    await user.click(within(sidebar).getByText('Tools'))
    // When pieceTools is empty, shows "No tools available..." message
    expect(screen.getByText(/No tools available/)).toBeInTheDocument()
  })
})
