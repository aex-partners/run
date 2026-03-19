import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { MailScreen, type MailEmail } from './MailScreen'

const mockEmails: MailEmail[] = [
  {
    id: '1',
    from: 'Roberto Almeida',
    fromEmail: 'roberto@acme.com.br',
    subject: 'Proposta comercial - Lote #4420',
    preview: 'Bom dia! Segue em anexo a proposta atualizada para o lote de materiais de construcao. Prazo de validade ate 20/03.',
    timestamp: '10:32',
    read: false,
    starred: true,
    hasAttachment: true,
    folder: 'inbox',
    labels: [{ name: 'Important', color: '#dc2626' }],
    aiSummary: 'Commercial proposal for construction materials. Deadline: March 20. Total: R$ 47,500.',
    thread: [
      {
        id: 't1',
        from: 'Roberto Almeida',
        fromEmail: 'roberto@acme.com.br',
        to: ['voce@empresa.com'],
        date: 'Mar 13, 10:32',
        content: 'Bom dia!\n\nSegue em anexo a proposta atualizada para o lote de materiais de construcao.\n\nItens incluidos:\n- 500 sacos de cimento CP-II (R$ 35/un)\n- 200 m3 de areia lavada (R$ 85/m3)\n- 1000 tijolos ceramicos (R$ 0,95/un)\n\nValor total: R$ 47.450,00\nPrazo de validade: 20/03/2026\nCondicoes: 30/60/90 dias\n\nAguardo retorno.\n\nAtt,\nRoberto Almeida\nAcme Materiais',
        attachments: [
          { name: 'proposta-4420.pdf', size: '2.4 MB', type: 'application/pdf' },
          { name: 'catalogo-precos.xlsx', size: '890 KB', type: 'application/xlsx' },
        ],
      },
    ],
    aiDraft: 'Roberto, obrigado pela proposta. Os precos estao dentro do orcamento. Vou validar com o financeiro e retorno ate amanha com a confirmacao do pedido.',
  },
  {
    id: '2',
    from: 'Fernanda Costa',
    fromEmail: 'fernanda@distribuidora.com',
    subject: 'Re: Confirmacao de entrega - Pedido #1092',
    preview: 'Entrega confirmada para amanha, dia 14/03. O motorista vai ligar 30 minutos antes.',
    timestamp: '09:15',
    read: false,
    folder: 'inbox',
    labels: [{ name: 'Logistics', color: '#2563eb' }],
    thread: [
      {
        id: 't1',
        from: 'You',
        fromEmail: 'voce@empresa.com',
        to: ['fernanda@distribuidora.com'],
        date: 'Mar 12, 16:40',
        content: 'Fernanda, pode confirmar a entrega do pedido #1092 para amanha?\n\nPrecisamos receber ate as 14h no maximo.',
      },
      {
        id: 't2',
        from: 'Fernanda Costa',
        fromEmail: 'fernanda@distribuidora.com',
        to: ['voce@empresa.com'],
        date: 'Mar 13, 09:15',
        content: 'Bom dia!\n\nEntrega confirmada para amanha, dia 14/03, entre 10h e 12h.\nO motorista vai ligar 30 minutos antes de chegar.\n\nNota fiscal: 9821\nVolumes: 3 paletes\n\nQualquer duvida estou a disposicao.\n\nAbs,\nFernanda',
      },
    ],
  },
  {
    id: '3',
    from: 'Sistema NF-e',
    fromEmail: 'nfe@sefaz.gov.br',
    subject: 'NF-e #8821 autorizada',
    preview: 'A nota fiscal eletronica numero 8821 foi autorizada com sucesso pela SEFAZ.',
    timestamp: 'Yesterday',
    read: true,
    starred: true,
    folder: 'inbox',
    labels: [{ name: 'Fiscal', color: '#059669' }],
    aiSummary: 'Invoice #8821 authorized. Buyer: Distribuidora Sul. Value: R$ 12,800.',
  },
  {
    id: '4',
    from: 'Carlos Mendes',
    fromEmail: 'carlos@logistics.com',
    subject: 'Atualizacao de rastreamento - Pedido #7792',
    preview: 'O pedido esta em transito e deve chegar na quarta-feira. O caminhao saiu do CD de Curitiba hoje pela manha.',
    timestamp: 'Yesterday',
    read: true,
    folder: 'inbox',
    aiSummary: 'Shipment in transit from Curitiba. ETA: Wednesday.',
  },
  {
    id: '5',
    from: 'Ana Paula Santos',
    fromEmail: 'ana.paula@empresa.com',
    subject: 'Relatorio mensal de vendas - Fevereiro 2026',
    preview: 'Segue o relatorio consolidado de vendas do mes de fevereiro. Tivemos um crescimento de 12% em relacao a janeiro.',
    timestamp: 'Mar 10',
    read: true,
    hasAttachment: true,
    folder: 'inbox',
    labels: [{ name: 'Reports', color: '#7c3aed' }],
  },
  {
    id: '6',
    from: 'Joao Pedro Lima',
    fromEmail: 'joao.pedro@fornecedor.com',
    subject: 'Orcamento de pecas - Maquina CNC',
    preview: 'Boa tarde, segue orcamento solicitado para as pecas de reposicao da maquina CNC modelo XR-200.',
    timestamp: 'Mar 9',
    read: true,
    hasAttachment: true,
    folder: 'inbox',
  },
  {
    id: '7',
    from: 'Suporte TI',
    fromEmail: 'suporte@empresa.com',
    subject: 'Manutencao programada - Sistema ERP',
    preview: 'Informamos que havera manutencao programada no sistema ERP no sabado, dia 15/03, das 22h as 02h.',
    timestamp: 'Mar 8',
    read: true,
    folder: 'inbox',
  },
  {
    id: '8',
    from: 'Mariana Oliveira',
    fromEmail: 'mariana@cliente.com',
    subject: 'Duvida sobre garantia do produto',
    preview: 'Ola, comprei o produto codigo SKU-4421 e gostaria de saber sobre a garantia estendida.',
    timestamp: 'Mar 7',
    read: true,
    folder: 'inbox',
    labels: [{ name: 'Support', color: '#d97706' }],
  },
  // Sent emails
  {
    id: 's1',
    from: 'You',
    fromEmail: 'voce@empresa.com',
    subject: 'Cotacao de frete - Rota SP-RJ',
    preview: 'Boa tarde, preciso de uma cotacao para frete rodoviario na rota Sao Paulo - Rio de Janeiro.',
    timestamp: 'Mar 12',
    read: true,
    folder: 'sent',
  },
  {
    id: 's2',
    from: 'You',
    fromEmail: 'voce@empresa.com',
    subject: 'Re: Pedido de compra #PO-2026-0340',
    preview: 'Pedido aprovado. Favor processar conforme condições acordadas.',
    timestamp: 'Mar 11',
    read: true,
    folder: 'sent',
  },
  // Drafts
  {
    id: 'd1',
    from: 'You',
    fromEmail: 'voce@empresa.com',
    subject: 'Proposta de parceria comercial',
    preview: 'Prezado Sr. Silva, gostaríamos de apresentar nossa proposta de parceria...',
    timestamp: 'Mar 12',
    read: true,
    folder: 'drafts',
  },
  // Spam
  {
    id: 'sp1',
    from: 'Marketing Digital Pro',
    fromEmail: 'promo@mktdigitalpro.xyz',
    subject: 'OFERTA IMPERDIVEL - 90% OFF em todos os planos!!!',
    preview: 'Aproveite agora! Promocao valida por tempo limitado. Clique aqui para garantir seu desconto.',
    timestamp: 'Mar 11',
    read: true,
    folder: 'spam',
  },
]

const mockLabels = [
  { id: 'l1', name: 'Important', color: '#dc2626', count: 3 },
  { id: 'l2', name: 'Fiscal', color: '#059669', count: 5 },
  { id: 'l3', name: 'Logistics', color: '#2563eb', count: 2 },
  { id: 'l4', name: 'Reports', color: '#7c3aed', count: 1 },
  { id: 'l5', name: 'Support', color: '#d97706', count: 4 },
]

const meta: Meta<typeof MailScreen> = {
  title: 'Screens/MailScreen',
  component: MailScreen,
  tags: ['screen'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    activeFolder: { control: 'select', options: ['inbox', 'sent', 'drafts', 'spam', 'trash', 'starred'] },
    loading: { control: 'boolean' },
  },
  args: {
    onFolderChange: fn(),
    onEmailClick: fn(),
    onEmailStar: fn(),
    onCompose: fn(),
    onSend: fn(),
    onReply: fn(),
    onReplyAll: fn(),
    onForward: fn(),
    onArchive: fn(),
    onDelete: fn(),
    onMarkRead: fn(),
    onMarkUnread: fn(),
    onRefresh: fn(),
    onAiAction: fn(),
    onAiDraft: fn(),
  },
}
export default meta
type Story = StoryObj<typeof MailScreen>

/** Default inbox view with unread emails. */
export const Default: Story = {
  args: {
    emails: mockEmails,
    labels: mockLabels,
    activeFolder: 'inbox',
    folderCounts: { inbox: 8, starred: 2, drafts: 1, spam: 1 },
  },
}

/** Email selected - shows the three-pane layout with detail view. */
export const EmailSelected: Story = {
  args: {
    emails: mockEmails,
    labels: mockLabels,
    activeFolder: 'inbox',
    activeEmailId: '1',
    folderCounts: { inbox: 8, starred: 2, drafts: 1, spam: 1 },
  },
}

/** Thread view - shows a multi-message thread with AI summary. */
export const ThreadView: Story = {
  args: {
    emails: mockEmails,
    labels: mockLabels,
    activeFolder: 'inbox',
    activeEmailId: '2',
    folderCounts: { inbox: 8, starred: 2, drafts: 1, spam: 1 },
  },
}

/** Sent folder view. */
export const SentFolder: Story = {
  args: {
    emails: mockEmails,
    labels: mockLabels,
    activeFolder: 'sent',
    folderCounts: { inbox: 8, sent: 2, drafts: 1 },
  },
}

/** Empty trash folder. */
export const EmptyFolder: Story = {
  args: {
    emails: mockEmails,
    labels: mockLabels,
    activeFolder: 'trash',
    folderCounts: { inbox: 8 },
  },
}

/** AI-powered email with draft suggestion visible. */
export const WithAiDraft: Story = {
  args: {
    emails: mockEmails,
    labels: mockLabels,
    activeFolder: 'inbox',
    activeEmailId: '1',
    folderCounts: { inbox: 8, starred: 2, drafts: 1, spam: 1 },
  },
}
