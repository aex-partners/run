import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { ChatScreen } from './ChatScreen'

const mockConversations = [
  { id: '1', name: 'RUN AI', type: 'ai' as const, lastMessage: 'Order #1047 has been confirmed.', timestamp: 'now', unreadCount: 3, pinned: true },
  { id: '2', name: 'Sales Agent', type: 'ai' as const, lastMessage: 'Monthly report is ready.', timestamp: '2m', agentName: 'Sales Agent' },
  { id: '3', name: 'Stock Agent', type: 'ai' as const, lastMessage: 'Product X is below minimum.', timestamp: '15m', unreadCount: 1, agentName: 'Stock Agent' },
  { id: '6', name: 'Maria Silva', type: 'dm' as const, lastMessage: 'Can you review the PO?', timestamp: '5m', unreadCount: 2, online: true, favorite: true },
  { id: '7', name: 'Carlos Mendes', type: 'dm' as const, lastMessage: 'Meeting at 3pm confirmed.', timestamp: '20m', online: true },
  { id: '8', name: 'Ana Costa', type: 'dm' as const, lastMessage: 'Invoice sent to client.', timestamp: '1h', online: false },
  { id: '4', name: 'general-support', type: 'group' as const, lastMessage: 'New ticket #204 opened.', timestamp: '1h' },
  { id: '5', name: 'operations', type: 'group' as const, lastMessage: 'Delivery confirmed.', timestamp: '2h', unreadCount: 5 },
]

const mockMessagesByConversation: Record<string, Array<{
  id: string
  role: 'user' | 'ai'
  content: string
  author: string
  timestamp: string
  date?: string
  readStatus?: 'sent' | 'delivered' | 'read'
  replyTo?: { author: string; content: string }
  actionCard?: { question: string; description?: string }
  audio?: { url: string; duration: string; waveform?: number[]; transcription?: string; transcriptionEdited?: boolean }
}>> = {
  '1': [
    { id: '1', role: 'user', content: 'What is the status of order #1047?', author: 'You', timestamp: '14:32', date: 'Yesterday', readStatus: 'read' },
    { id: '2', role: 'ai', content: 'Order **#1047** from *Acme Ltd* is currently **being separated** in stock. Estimated dispatch: **today at 17:00**.\n\n3 items · $2,450.00 · Carrier: FastLog', author: 'RUN AI', timestamp: '14:32', date: 'Yesterday' },
    { id: '3', role: 'user', content: 'Can you move up the delivery to before 3pm?', author: 'You', timestamp: '09:10', date: 'Today', readStatus: 'read' },
    {
      id: '4',
      role: 'ai',
      content: 'I checked with the logistics team. It is possible to move dispatch to **14:45**, but it will require approval from the stock manager.',
      author: 'RUN AI',
      timestamp: '09:11',
      date: 'Today',
      actionCard: { question: 'Request approval to move dispatch of order #1047 to 14:45?' },
    },
  ],
  '2': [
    { id: '1', role: 'user', content: 'Can you pull the monthly sales report?', author: 'You', timestamp: '09:10', date: 'Today', readStatus: 'read' },
    { id: '2', role: 'ai', content: 'The **March 2026** sales report is ready. Total revenue: **$148,320**. Top product: *Premium Widget* with 412 units sold.', author: 'Sales Agent', timestamp: '09:10', date: 'Today' },
  ],
  '3': [
    { id: '1', role: 'ai', content: 'Alert: **Product X** (SKU-8821) has dropped below the minimum stock threshold. Current level: **3 units**. Reorder point: **10 units**.', author: 'Stock Agent', timestamp: '08:45', date: 'Today' },
    { id: '2', role: 'user', content: 'Place a reorder for 50 units please.', author: 'You', timestamp: '08:47', date: 'Today', readStatus: 'read' },
    { id: '3', role: 'ai', content: 'Reorder for **50 units** of Product X has been submitted to the preferred supplier. Expected delivery: **2-3 business days**.', author: 'Stock Agent', timestamp: '08:47', date: 'Today' },
  ],
  '4': [
    { id: '1', role: 'ai', content: 'I just reviewed the ticket and it seems to be a billing issue.', author: 'Maria Silva', timestamp: '11:00', date: 'Today' },
    { id: '2', role: 'ai', content: 'I can take this one. Let me check the customer account.', author: 'Carlos Mendes', timestamp: '11:02', date: 'Today' },
    { id: '3', role: 'user', content: 'Thanks Carlos. Keep me posted.', author: 'You', timestamp: '11:05', date: 'Today', readStatus: 'read' },
  ],
  '5': [
    { id: '1', role: 'ai', content: 'Delivery for shipment **SHP-9923** has been confirmed. Delivered at **10:32** to warehouse B.', author: 'RUN AI', timestamp: '10:35', date: 'Today' },
    { id: '2', role: 'user', content: 'Great, please update the inventory records.', author: 'You', timestamp: '10:36', date: 'Today', readStatus: 'read' },
  ],
  '6': [
    { id: '1', role: 'ai', content: 'Hi! I just sent the purchase order for the new batch of components. Can you review it?', author: 'Maria Silva', timestamp: '14:20', date: 'Yesterday' },
    { id: '2', role: 'user', content: 'Sure, which supplier is it for?', author: 'You', timestamp: '14:21', date: 'Yesterday', readStatus: 'read' },
    { id: '3', role: 'ai', content: 'It is for **TechParts Inc.**. PO **#2089** with **24 items** totaling **$8,750.00**.', author: 'Maria Silva', timestamp: '14:22', date: 'Yesterday' },
  ],
  '7': [
    { id: '1', role: 'user', content: 'Hey Carlos, are we still on for the logistics review at 3pm?', author: 'You', timestamp: '13:00', date: 'Today', readStatus: 'read' },
    { id: '2', role: 'ai', content: 'Yes, confirmed! I will bring the updated route optimization report.', author: 'Carlos Mendes', timestamp: '13:02', date: 'Today' },
  ],
  '8': [
    { id: '1', role: 'ai', content: 'I just sent the invoice for order **#1032** to *Acme Ltd*. Total: **$12,400.00**.', author: 'Ana Costa', timestamp: '11:30', date: 'Today' },
    { id: '2', role: 'user', content: 'Thanks Ana. Did you include the discount we agreed on?', author: 'You', timestamp: '11:32', date: 'Today', readStatus: 'read' },
  ],
}

const meta: Meta<typeof ChatScreen> = {
  title: 'Screens/ChatScreen',
  component: ChatScreen,
  tags: ['chat'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onConversationSelect: { action: 'conversation-selected' },
    onInviteMember: { action: 'invite-member' },
    onAddMaestro: { action: 'add-maestro' },
    onSendMessage: { action: 'message-sent' },
    onPin: { action: 'pinned' },
    onFavorite: { action: 'favorited' },
    onMute: { action: 'muted' },
  },
  args: {
    onConversationSelect: fn(),
    onInviteMember: fn(),
    onAddMaestro: fn(),
    onSendMessage: fn(),
    onPin: fn(),
    onFavorite: fn(),
    onMute: fn(),
    onReact: fn(),
    onForwardMessages: fn(),
    onPinMessage: fn(),
    onStarMessage: fn(),
    onDeleteForEveryone: fn(),
    onDeleteForMe: fn(),
    onCancelTask: fn(),
    onRetryTask: fn(),
    onViewTaskLogs: fn(),
    onTaskClick: fn(),
    onTranscriptionEdit: fn(),
  },
  decorators: [(Story) => <div style={{ height: '100vh' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof ChatScreen>

export const Default: Story = {
  args: {
    conversations: mockConversations,
    messages: [],
    messagesByConversation: mockMessagesByConversation,
    activeConversationId: '1',
    workspaceName: 'Buenaca',
  },
}

export const DirectMessage: Story = {
  args: {
    conversations: mockConversations,
    messages: [],
    messagesByConversation: mockMessagesByConversation,
    activeConversationId: '6',
    workspaceName: 'Buenaca',
  },
}

export const GroupConversation: Story = {
  args: {
    conversations: mockConversations,
    messages: [],
    messagesByConversation: mockMessagesByConversation,
    activeConversationId: '4',
    workspaceName: 'Buenaca',
  },
}

export const NoConversationSelected: Story = {
  args: {
    conversations: mockConversations,
    messages: [],
    workspaceName: 'Buenaca',
  },
}

export const WithTaskBar: Story = {
  args: {
    conversations: mockConversations,
    messages: [],
    messagesByConversation: mockMessagesByConversation,
    activeConversationId: '1',
    workspaceName: 'Buenaca',
    tasks: [
      { id: '1', title: 'Processar importacao de fornecedores', description: 'Lendo planilha Excel', status: 'running' as const, agent: 'Import Agent', startTime: '2 min ago', progress: 65, taskType: 'structured' as const, conversationId: '1' },
      { id: '2', title: 'Gerar relatorio mensal', status: 'pending' as const, agent: 'Sales Agent', startTime: '5 min ago', taskType: 'inference' as const, conversationId: '1' },
      { id: '3', title: 'Sincronizar estoque', status: 'failed' as const, agent: 'Stock Agent', startTime: '10 min ago', duration: '3m 22s', conversationId: '2' },
      { id: '4', title: 'Backup do banco', status: 'completed' as const, agent: 'System Agent', startTime: '30 min ago', duration: '5m 10s', conversationId: '1' },
    ],
  },
}

export const WithAudioMessages: Story = {
  args: {
    conversations: mockConversations,
    messages: [],
    messagesByConversation: {
      ...mockMessagesByConversation,
      '1': [
        ...mockMessagesByConversation['1'],
        {
          id: '5',
          role: 'user' as const,
          content: '',
          author: 'You',
          timestamp: '09:20',
          date: 'Today',
          readStatus: 'read' as const,
          audio: {
            url: 'https://example.com/voice-note.mp3',
            duration: '0:42',
            waveform: [0.2, 0.4, 0.6, 0.8, 0.5, 0.3, 0.7, 0.9, 0.6, 0.4, 0.8, 1.0, 0.7, 0.5, 0.3, 0.6, 0.8, 0.4, 0.2, 0.5, 0.7, 0.9, 0.6, 0.3, 0.5, 0.8, 0.4, 0.6, 0.7, 0.3],
            transcription: 'Pode antecipar o despacho do pedido #1047 para antes das 15h? Preciso que chegue no cliente ainda hoje.',
          },
        },
        {
          id: '6',
          role: 'ai' as const,
          content: 'Entendi seu pedido de audio. Vou verificar com a equipe de logistica sobre a antecipacao.',
          author: 'RUN AI',
          timestamp: '09:21',
          date: 'Today',
        },
      ],
    },
    activeConversationId: '1',
    workspaceName: 'Buenaca',
  },
}

export const WithAgentSelector: Story = {
  name: 'With Agent Selector',
  args: {
    conversations: mockConversations,
    messages: [],
    messagesByConversation: mockMessagesByConversation,
    activeConversationId: '1',
    workspaceName: 'Buenaca',
    agents: [
      { id: 'sales', name: 'Sales Maestro' },
      { id: 'stock', name: 'Stock Maestro' },
      { id: 'support', name: 'Support Maestro' },
    ],
  },
}
