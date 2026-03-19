import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { ConversationList } from './ConversationList'

const mockConversations = [
  { id: '1', name: 'RUN AI', type: 'ai' as const, lastMessage: 'Order #1047 has been confirmed.', timestamp: 'now', unreadCount: 3, pinned: true },
  { id: '2', name: 'Sales Agent', type: 'ai' as const, lastMessage: 'Monthly report is ready.', timestamp: '2m', agentName: 'Sales Agent' },
  { id: '3', name: 'Ana Lima', type: 'dm' as const, lastMessage: 'Hey, how are you?', timestamp: '15m', online: true, favorite: true },
  { id: '6', name: 'Carlos Mendes', type: 'dm' as const, lastMessage: 'Meeting at 3pm confirmed.', timestamp: '20m', online: true, unreadCount: 1 },
  { id: '7', name: 'Maria Silva', type: 'dm' as const, lastMessage: 'Can you review the PO?', timestamp: '5m', online: false, unreadCount: 2, favorite: true },
  { id: '4', name: 'general-support', type: 'group' as const, lastMessage: 'New ticket #204 opened.', timestamp: '1h' },
  { id: '5', name: 'operations', type: 'group' as const, lastMessage: 'Delivery confirmed to SP.', timestamp: '2h', unreadCount: 5 },
]

const meta: Meta<typeof ConversationList> = {
  title: 'Organisms/ConversationList',
  component: ConversationList,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onSelect: { action: 'selected' },
    onInviteMember: { action: 'invite-member' },
    onAddMaestro: { action: 'add-maestro' },
    onMute: { action: 'muted' },
    onPin: { action: 'pinned' },
    onFavorite: { action: 'favorited' },
  },
  args: { onSelect: fn(), onInviteMember: fn(), onAddMaestro: fn(), onMute: fn(), onPin: fn(), onFavorite: fn() },
  decorators: [(Story) => <div style={{ width: 280, height: 500, background: 'var(--surface)', border: '1px solid var(--border)' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof ConversationList>

export const Default: Story = {
  args: { conversations: mockConversations, activeId: '1', workspaceName: 'Buenaca' },
}

export const Empty: Story = {
  args: { conversations: [], workspaceName: 'My Company' },
}

export const WithPinnedAndFavorites: Story = {
  args: { conversations: mockConversations, activeId: '1', workspaceName: 'TechCorp' },
}

export const OnlyGroups: Story = {
  args: {
    conversations: [
      { id: '1', name: 'general-support', type: 'group' as const, lastMessage: 'New ticket opened.', timestamp: '1h' },
      { id: '2', name: 'operations', type: 'group' as const, lastMessage: 'Delivery update.', timestamp: '2h', unreadCount: 3 },
      { id: '3', name: 'engineering', type: 'group' as const, lastMessage: 'Deploy v2.1 done.', timestamp: '3h' },
    ],
    activeId: '1',
    workspaceName: 'Acme Inc',
  },
}
