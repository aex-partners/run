import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { MailItem } from './MailItem'

const meta: Meta<typeof MailItem> = {
  title: 'Molecules/MailItem',
  component: MailItem,
  tags: ['mail'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    read: { control: 'boolean' },
    starred: { control: 'boolean' },
    hasAttachment: { control: 'boolean' },
    selected: { control: 'boolean' },
    active: { control: 'boolean' },
  },
  args: { onClick: fn(), onStar: fn(), onSelect: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 600 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof MailItem>

export const Unread: Story = {
  args: {
    id: '1',
    from: 'Roberto Almeida',
    fromEmail: 'roberto@acme.com.br',
    subject: 'Proposta comercial - Lote #4420',
    preview: 'Bom dia! Segue em anexo a proposta atualizada para o lote de materiais...',
    timestamp: '10:32',
    read: false,
    hasAttachment: true,
    labels: [{ name: 'Important', color: '#dc2626' }],
  },
}

export const Read: Story = {
  args: {
    id: '2',
    from: 'Fernanda Costa',
    fromEmail: 'fernanda@distribuidora.com',
    subject: 'Re: Confirmacao de entrega',
    preview: 'Entrega confirmada para amanha, dia 14/03. Favor confirmar recebimento.',
    timestamp: 'Yesterday',
    read: true,
  },
}

export const Starred: Story = {
  args: {
    id: '3',
    from: 'Sistema NF-e',
    fromEmail: 'nfe@sefaz.gov.br',
    subject: 'NF-e #8821 autorizada',
    preview: 'A nota fiscal eletronica numero 8821 foi autorizada com sucesso.',
    timestamp: 'Mar 11',
    read: true,
    starred: true,
    labels: [{ name: 'Fiscal', color: '#059669' }],
  },
}

export const WithAiSummary: Story = {
  args: {
    id: '4',
    from: 'Carlos Mendes',
    fromEmail: 'carlos@logistics.com',
    subject: 'Atualizacao de rastreamento - Pedido #7792',
    preview: 'O pedido esta em transito e deve chegar na quarta-feira...',
    timestamp: '2h',
    read: false,
    aiSummary: 'Delivery delayed by 1 day. New ETA: Wednesday.',
  },
}

export const Selected: Story = {
  args: {
    id: '5',
    from: 'Ana Paula',
    fromEmail: 'ana.paula@empresa.com',
    subject: 'Relatorio mensal de vendas',
    preview: 'Oi, segue o relatorio consolidado de vendas do mes de fevereiro...',
    timestamp: '3d',
    read: true,
    selected: true,
    hasAttachment: true,
  },
}
