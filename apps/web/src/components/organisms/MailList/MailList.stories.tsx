import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { MailList } from './MailList'

const mockEmails = [
  {
    id: '1',
    from: 'Roberto Almeida',
    fromEmail: 'roberto@acme.com.br',
    subject: 'Proposta comercial - Lote #4420',
    preview: 'Bom dia! Segue em anexo a proposta atualizada para o lote de materiais.',
    timestamp: '10:32',
    read: false,
    starred: true,
    hasAttachment: true,
    labels: [{ name: 'Important', color: '#dc2626' }] as { name: string; color: string }[],
  },
  {
    id: '2',
    from: 'Fernanda Costa',
    fromEmail: 'fernanda@distribuidora.com',
    subject: 'Re: Confirmacao de entrega - Pedido #1092',
    preview: 'Entrega confirmada para amanha.',
    timestamp: '09:15',
    read: false,
    labels: [{ name: 'Logistics', color: '#2563eb' }] as { name: string; color: string }[],
  },
  {
    id: '3',
    from: 'Sistema NF-e',
    fromEmail: 'nfe@sefaz.gov.br',
    subject: 'NF-e #8821 autorizada',
    preview: 'A nota fiscal eletronica numero 8821 foi autorizada com sucesso.',
    timestamp: 'Yesterday',
    read: true,
    starred: true,
    labels: [{ name: 'Fiscal', color: '#059669' }] as { name: string; color: string }[],
  },
  {
    id: '4',
    from: 'Carlos Mendes',
    fromEmail: 'carlos@logistics.com',
    subject: 'Atualizacao de rastreamento',
    preview: 'O pedido esta em transito e deve chegar na quarta-feira.',
    timestamp: 'Yesterday',
    read: true,
  },
  {
    id: '5',
    from: 'Ana Paula Santos',
    fromEmail: 'ana.paula@empresa.com',
    subject: 'Relatorio mensal de vendas',
    preview: 'Segue o relatorio consolidado de vendas do mes de fevereiro.',
    timestamp: 'Mar 10',
    read: true,
    hasAttachment: true,
  },
]

const meta: Meta<typeof MailList> = {
  title: 'Organisms/MailList',
  component: MailList,
  tags: ['mail'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    onEmailClick: fn(),
    onEmailStar: fn(),
    onEmailSelect: fn(),
    onSelectAll: fn(),
    onArchive: fn(),
    onDelete: fn(),
    onMarkRead: fn(),
    onMarkUnread: fn(),
    onRefresh: fn(),
  },
  decorators: [(Story) => <div style={{ height: '100vh', maxWidth: 500 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof MailList>

export const Default: Story = {
  args: {
    emails: mockEmails,
  },
}

export const WithSelection: Story = {
  args: {
    emails: mockEmails,
    selectedIds: new Set(['1', '3']),
  },
}

export const WithActiveEmail: Story = {
  args: {
    emails: mockEmails,
    activeEmailId: '2',
  },
}

export const Empty: Story = {
  args: {
    emails: [],
  },
}
