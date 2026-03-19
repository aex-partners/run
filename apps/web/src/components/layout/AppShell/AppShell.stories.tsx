import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { AppShell } from './AppShell'

const meta: Meta<typeof AppShell> = {
  title: 'Layout/AppShell',
  component: AppShell,
  tags: ['layout'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    activeSection: { control: 'select', options: ['chat', 'database', 'tasks', 'workflows', 'settings'] },
    onSectionChange: { action: 'section-changed' },
    onLogout: { action: 'logout' },
  },
  args: { onSectionChange: fn(), onLogout: fn() },
  decorators: [(Story) => <div style={{ height: '100vh' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof AppShell>

export const Default: Story = {
  args: {
    activeSection: 'chat',
    currentUser: 'Ana Lima',
    currentUserEmail: 'ana@aex.app',
    children: (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        Select a section in the sidebar
      </div>
    ),
  },
}

export const DatabaseActive: Story = {
  args: {
    activeSection: 'database',
    currentUser: 'Carlos Mendes',
    currentUserEmail: 'carlos@aex.app',
    children: (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        Database
      </div>
    ),
  },
}

export const TasksActive: Story = {
  args: {
    activeSection: 'tasks',
    currentUser: 'Ana Lima',
    currentUserEmail: 'ana@aex.app',
    children: (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        Tasks
      </div>
    ),
  },
}

export const WorkflowsActive: Story = {
  args: {
    activeSection: 'workflows',
    currentUser: 'Bruno Costa',
    currentUserEmail: 'bruno@aex.app',
    children: (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        Workflows
      </div>
    ),
  },
}

export const SettingsActive: Story = {
  args: {
    activeSection: 'settings',
    currentUser: 'Mariana Souza',
    currentUserEmail: 'mariana@aex.app',
    children: (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        Settings
      </div>
    ),
  },
}

/** Click the avatar in the top-right corner to open the user menu with logout option */
export const UserMenuOpen: Story = {
  args: {
    activeSection: 'chat',
    currentUser: 'Ana Lima',
    currentUserEmail: 'ana@aex.app',
    children: (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        Click the avatar at the bottom of the sidebar to open the user menu.
      </div>
    ),
  },
}
