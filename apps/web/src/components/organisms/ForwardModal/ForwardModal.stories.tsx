import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { ForwardModal } from './ForwardModal'

const mockConversations = [
  { id: '1', name: 'RUN AI', type: 'ai' as const, lastMessage: 'Order #1047 has been confirmed.', timestamp: 'now' },
  { id: '2', name: 'Sales Agent', type: 'ai' as const, lastMessage: 'Monthly report is ready.', timestamp: '2m', agentName: 'Sales Agent' },
  { id: '3', name: 'Maria Silva', type: 'dm' as const, lastMessage: 'Can you review the PO?', timestamp: '5m', online: true },
  { id: '4', name: 'Carlos Mendes', type: 'dm' as const, lastMessage: 'Meeting at 3pm confirmed.', timestamp: '20m', online: true },
  { id: '5', name: 'Ana Costa', type: 'dm' as const, lastMessage: 'Invoice sent to client.', timestamp: '1h', online: false },
  { id: '6', name: 'general-support', type: 'group' as const, lastMessage: 'New ticket #204 opened.', timestamp: '1h' },
  { id: '7', name: 'operations', type: 'group' as const, lastMessage: 'Delivery confirmed.', timestamp: '2h' },
]

const meta: Meta<typeof ForwardModal> = {
  title: 'Organisms/ForwardModal',
  component: ForwardModal,
  tags: ['chat'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    onConfirm: fn(),
    conversations: mockConversations,
  },
}
export default meta
type Story = StoryObj<typeof ForwardModal>

export const Default: Story = {}

export const WithSelections: Story = {
  render: (args) => (
    <ForwardModal {...args} />
  ),
}

export const EmptySearch: Story = {
  args: {
    conversations: [],
  },
}
