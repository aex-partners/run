import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { PromptInput } from './PromptInput'

const meta: Meta<typeof PromptInput> = {
  title: 'Organisms/PromptInput',
  component: PromptInput,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    micState: { control: 'radio', options: ['idle', 'recording', 'processing'] },
    disabled: { control: 'boolean' },
    onSend: { action: 'sent' },
    onMicClick: { action: 'mic clicked' },
    onAttachmentAdd: { action: 'attachment added' },
    onAttachmentRemove: { action: 'attachment removed' },
    onCancelReply: { action: 'reply cancelled' },
  },
  args: {
    onSend: fn(),
    onMicClick: fn(),
    onAttachmentAdd: fn(),
    onAttachmentRemove: fn(),
    onCancelReply: fn(),
  },
}
export default meta
type Story = StoryObj<typeof PromptInput>

export const Default: Story = {
  args: {
    placeholder: 'Mensagem para RUN...',
  },
}

export const WithAttachments: Story = {
  args: {
    placeholder: 'Mensagem...',
    attachments: [
      { id: '1', fileName: 'relatorio-vendas.pdf', fileSize: '2.4 MB', fileType: 'application/pdf' },
      { id: '2', fileName: 'foto-produto.jpg', fileSize: '890 KB', fileType: 'image/jpeg' },
      { id: '3', fileName: 'dados.xlsx', fileSize: '1.1 MB', fileType: 'application/spreadsheet' },
    ],
  },
}

export const WithReply: Story = {
  args: {
    placeholder: 'Mensagem...',
    replyTo: {
      author: 'RUN AI',
      content: 'Encontrei 23 pedidos pendentes no sistema. Deseja ver os detalhes?',
    },
  },
}

export const Recording: Story = {
  args: {
    placeholder: 'Mensagem...',
    micState: 'recording',
  },
}

export const Processing: Story = {
  args: {
    placeholder: 'Mensagem...',
    micState: 'processing',
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Mensagem...',
    disabled: true,
  },
}

export const FullFeatured: Story = {
  args: {
    placeholder: 'Mensagem para RUN...',
    attachments: [
      { id: '1', fileName: 'planilha-estoque.xlsx', fileSize: '1.1 MB', fileType: 'application/spreadsheet' },
    ],
    replyTo: {
      author: 'Carlos Mendes',
      content: 'Preciso do relatorio de estoque atualizado ate sexta.',
    },
  },
}

export const WithText: Story = {
  args: {
    placeholder: 'Mensagem...',
    value: 'Pode me enviar o relatorio de vendas do trimestre?',
  },
}

export const LongText: Story = {
  args: {
    placeholder: 'Mensagem...',
    value: 'Linha 1\nLinha 2\nLinha 3\nLinha 4\nLinha 5\nLinha 6\nLinha 7\nLinha 8\nLinha 9\nEssa mensagem tem varias linhas para testar o auto-grow do textarea ate o limite de 6 linhas visiveis.',
  },
}
