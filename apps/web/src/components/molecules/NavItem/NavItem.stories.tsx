import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { MessageSquare, Database, CheckSquare, GitBranch, Settings, Bell } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { NavItem } from './NavItem'

const meta: Meta<typeof NavItem> = {
  title: 'Molecules/NavItem',
  component: NavItem,
  tags: ['layout'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    active: { control: 'boolean' },
    badge: { control: 'number' },
    onClick: { action: 'clicked' },
  },
  args: { onClick: fn() },
  decorators: [
    (Story) => (
      <Tooltip.Provider delayDuration={0}>
        <div style={{ background: 'var(--surface)', padding: 8, borderRadius: 8 }}>
          <Story />
        </div>
      </Tooltip.Provider>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof NavItem>

export const Default: Story = {
  args: { icon: <MessageSquare size={20} />, label: 'Chat' },
}

export const Active: Story = {
  args: { icon: <Database size={20} />, label: 'Database', active: true },
}

export const WithBadge: Story = {
  args: { icon: <CheckSquare size={20} />, label: 'Tasks', badge: 4 },
}

export const ActiveWithBadge: Story = {
  args: { icon: <GitBranch size={20} />, label: 'Workflows', active: true, badge: 2 },
}

export const SettingsItem: Story = {
  args: { icon: <Settings size={20} />, label: 'Settings' },
}

/** Badge of 99 — verifies the pill fits and truncates if needed. */
export const WithHighBadge: Story = {
  args: { icon: <Bell size={20} />, label: 'Notifications', badge: 99 },
}

/** Badge of 0 — the badge element should not render at all. */
export const ZeroBadge: Story = {
  args: { icon: <Bell size={20} />, label: 'Notifications', badge: 0 },
}
