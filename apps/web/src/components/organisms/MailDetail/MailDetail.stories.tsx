import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { MailDetail } from './MailDetail'

const meta: Meta<typeof MailDetail> = {
  title: 'Organisms/MailDetail',
  component: MailDetail,
  tags: ['mail'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    onBack: fn(),
    emailPosition: '3 of 42',
    onReply: fn(),
    onReplyAll: fn(),
    onForward: fn(),
    onArchive: fn(),
    onDelete: fn(),
    onStar: fn(),
    onApplyAiDraft: fn(),
  },
  decorators: [(Story) => <div style={{ height: '100vh' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof MailDetail>

export const SingleMessage: Story = {
  args: {
    subject: 'Proposta comercial - Lote #4420',
    starred: true,
    labels: [{ name: 'Important', color: '#dc2626' }],
    messages: [
      {
        id: '1',
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
    aiSummary: 'Commercial proposal for construction materials. 3 items totaling R$ 47,450. Payment: 30/60/90 days. Deadline: March 20.',
    aiDraft: 'Roberto, obrigado pela proposta. Os precos estao dentro do orcamento previsto. Vou validar com o financeiro e retorno ate amanha com a confirmacao.',
  },
}

export const Thread: Story = {
  args: {
    subject: 'Re: Confirmacao de entrega - Pedido #1092',
    labels: [{ name: 'Logistics', color: '#2563eb' }],
    messages: [
      {
        id: '1',
        from: 'You',
        fromEmail: 'voce@empresa.com',
        to: ['fernanda@distribuidora.com'],
        date: 'Mar 12, 16:40',
        content: 'Fernanda, pode confirmar a entrega do pedido #1092 para amanha?\n\nPrecisamos receber ate as 14h no maximo.',
      },
      {
        id: '2',
        from: 'Fernanda Costa',
        fromEmail: 'fernanda@distribuidora.com',
        to: ['voce@empresa.com'],
        date: 'Mar 13, 09:15',
        content: 'Bom dia!\n\nEntrega confirmada para amanha, dia 14/03, entre 10h e 12h.\nO motorista vai ligar 30 minutos antes de chegar.\n\nNota fiscal: 9821\nVolumes: 3 paletes\n\nQualquer duvida estou a disposicao.\n\nAbs,\nFernanda',
      },
      {
        id: '3',
        from: 'You',
        fromEmail: 'voce@empresa.com',
        to: ['fernanda@distribuidora.com'],
        date: 'Mar 13, 09:20',
        content: 'Perfeito, obrigado Fernanda! Vou avisar o almoxarifado.\n\nAbs',
      },
    ],
  },
}
