import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { ConversationItem } from './ConversationItem'

const meta: Meta<typeof ConversationItem> = {
  title: 'Molecules/ConversationItem',
  component: ConversationItem,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    type: { control: 'select', options: ['dm', 'group', 'channel', 'ai'] },
    active: { control: 'boolean' },
    online: { control: 'boolean' },
    pinned: { control: 'boolean' },
    onClick: { action: 'clicked' },
  },
  args: { onClick: fn() },
  decorators: [(Story) => <div style={{ width: 280, background: 'var(--surface)' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof ConversationItem>

export const Default: Story = {
  args: { name: 'Ana Lima', lastMessage: 'Hey, how are you?', timestamp: '2m', type: 'dm' },
}

export const DM: Story = {
  args: { name: 'Carlos Mendes', lastMessage: 'Monthly report is ready.', timestamp: '5m', type: 'dm', online: true },
}

export const AIAssistant: Story = {
  args: { name: 'RUN AI', lastMessage: 'Order #1047 has been confirmed.', timestamp: 'now', type: 'ai', unreadCount: 3 },
}

export const Group: Story = {
  args: { name: 'general-support', lastMessage: 'New ticket #204 opened.', timestamp: '1h', type: 'group' },
}

export const WithUnread: Story = {
  args: { name: 'operations', lastMessage: 'Delivery confirmed.', timestamp: '2h', type: 'group', unreadCount: 5 },
}

export const Active: Story = {
  args: { name: 'RUN AI', lastMessage: 'How can I help?', timestamp: 'now', type: 'ai', active: true },
}

export const Pinned: Story = {
  args: { name: 'RUN AI', lastMessage: 'Order status updated.', timestamp: '10m', type: 'ai', pinned: true },
}

export const PinnedWithUnread: Story = {
  args: {
    name: 'Maria Silva',
    lastMessage: 'Can you check the report?',
    timestamp: '1m',
    type: 'dm',
    online: true,
    unreadCount: 5,
    pinned: true,
  },
}

export const CustomAgent: Story = {
  args: {
    name: 'Sales Agent',
    lastMessage: 'Report is ready.',
    timestamp: '2m',
    type: 'ai',
    agentName: 'Sales Agent',
  },
}
