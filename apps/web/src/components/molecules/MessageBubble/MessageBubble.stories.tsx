import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { MessageBubble } from './MessageBubble'

const meta: Meta<typeof MessageBubble> = {
  title: 'Molecules/MessageBubble',
  component: MessageBubble,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    role: { control: 'select', options: ['user', 'ai', 'system'] },
    readStatus: { control: 'select', options: [undefined, 'sent', 'delivered', 'read'] },
    showAuthor: { control: 'boolean' },
    pinned: { control: 'boolean' },
    starred: { control: 'boolean' },
  },
  decorators: [(Story) => <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 8 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof MessageBubble>

export const Default: Story = {
  args: { role: 'ai', content: 'Hello! How can I help you?', author: 'RUN AI', timestamp: '14:30' },
}

export const UserMessage: Story = {
  args: { role: 'user', content: 'What is the status of order #1047?', author: 'You', timestamp: '14:32', readStatus: 'read' },
}

export const UserSent: Story = {
  args: { role: 'user', content: 'Just sent this message.', author: 'You', timestamp: '14:33', readStatus: 'sent' },
}

export const UserDelivered: Story = {
  args: { role: 'user', content: 'This message was delivered.', author: 'You', timestamp: '14:34', readStatus: 'delivered' },
}

export const AIMessage: Story = {
  args: {
    role: 'ai',
    content: 'Order **#1047** from *Acme Ltd* is currently **being separated** in stock. Estimated dispatch: **today at 17:00**.',
    author: 'RUN AI',
    timestamp: '14:32',
  },
}

export const SystemMessage: Story = {
  args: { role: 'system', content: 'Conversation started at 14:00', author: 'System' },
}

export const WithReplyQuote: Story = {
  args: {
    role: 'user',
    content: 'Yes, please go ahead with the dispatch.',
    author: 'You',
    timestamp: '14:35',
    readStatus: 'read',
    replyTo: { author: 'RUN AI', content: 'I checked with the logistics team. It is possible to move dispatch to 14:45.' },
  },
}

export const GroupMessageWithAuthor: Story = {
  args: {
    role: 'ai',
    content: 'I just sent the purchase order for the new batch of components.',
    author: 'Maria Silva',
    timestamp: '14:20',
    showAuthor: true,
  },
}

export const LongContent: Story = {
  args: {
    role: 'ai',
    content: `Here is a detailed breakdown of the order situation:\n\nOrder #1047 was placed by Acme Ltd on Monday and contains 12 line items totalling $4,820.\n\nThe warehouse team started picking at 13:45. Three items are currently out of stock and have been flagged for reorder. The remaining nine items are packed and ready for dispatch.\n\nEstimated delivery to the customer is Thursday before noon, assuming the courier collection happens today at 17:00.`,
    author: 'RUN AI',
    timestamp: '14:35',
  },
}

export const Pinned: Story = {
  args: {
    role: 'ai',
    content: 'This message has been pinned for easy reference.',
    author: 'RUN AI',
    timestamp: '14:30',
    pinned: true,
  },
}

export const Starred: Story = {
  args: {
    role: 'user',
    content: 'Important: review the Q1 report before Thursday.',
    author: 'You',
    timestamp: '14:32',
    readStatus: 'read',
    starred: true,
  },
}

export const AudioMessage: Story = {
  args: {
    role: 'user',
    content: '',
    author: 'You',
    timestamp: '14:40',
    readStatus: 'read',
    isOwner: true,
    onTranscriptionEdit: fn(),
    audio: {
      url: 'https://example.com/voice-note.mp3',
      duration: '0:42',
      waveform: [0.2, 0.4, 0.6, 0.8, 0.5, 0.3, 0.7, 0.9, 0.6, 0.4, 0.8, 1.0, 0.7, 0.5, 0.3, 0.6, 0.8, 0.4, 0.2, 0.5, 0.7, 0.9, 0.6, 0.3, 0.5, 0.8, 0.4, 0.6, 0.7, 0.3],
      transcription: 'Pode antecipar o despacho do pedido para antes das 15h?',
    },
  },
}

export const AudioMessageEdited: Story = {
  args: {
    role: 'user',
    content: '',
    author: 'You',
    timestamp: '14:40',
    readStatus: 'read',
    isOwner: true,
    onTranscriptionEdit: fn(),
    audio: {
      url: 'https://example.com/voice-note.mp3',
      duration: '0:42',
      waveform: [0.2, 0.4, 0.6, 0.8, 0.5, 0.3, 0.7, 0.9, 0.6, 0.4, 0.8, 1.0, 0.7, 0.5, 0.3, 0.6, 0.8, 0.4, 0.2, 0.5, 0.7, 0.9, 0.6, 0.3, 0.5, 0.8, 0.4, 0.6, 0.7, 0.3],
      transcription: 'Pode antecipar o despacho do pedido #1047 para antes das 15h?',
      transcriptionEdited: true,
    },
  },
}
