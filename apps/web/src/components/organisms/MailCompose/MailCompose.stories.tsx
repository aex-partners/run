import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { MailCompose } from './MailCompose'

const meta: Meta<typeof MailCompose> = {
  title: 'Organisms/MailCompose',
  component: MailCompose,
  tags: ['mail'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    onClose: fn(),
    onSend: fn(),
    onAiDraft: fn(),
    onToggleMinimize: fn(),
  },
}
export default meta
type Story = StoryObj<typeof MailCompose>

export const NewMessage: Story = {
  args: {
    open: true,
  },
}

export const Reply: Story = {
  args: {
    open: true,
    to: 'roberto@acme.com.br',
    subject: 'Proposta comercial - Lote #4420',
    replyMode: 'reply',
  },
}

export const Forward: Story = {
  args: {
    open: true,
    subject: 'NF-e #8821 autorizada',
    replyMode: 'forward',
  },
}

export const Minimized: Story = {
  args: {
    open: true,
    to: 'fernanda@distribuidora.com',
    subject: 'Re: Confirmacao de entrega',
    replyMode: 'reply',
    minimized: true,
  },
}

export const AiDrafting: Story = {
  args: {
    open: true,
    aiDrafting: true,
  },
}
