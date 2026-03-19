import type { Meta, StoryObj } from '@storybook/react'
import { InlineCitation } from './InlineCitation'

const meta: Meta<typeof InlineCitation> = {
  title: 'Atoms/InlineCitation',
  component: InlineCitation,
  tags: ['ai'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    index: { control: 'number' },
    title: { control: 'text' },
    url: { control: 'text' },
    quote: { control: 'text' },
  },
}
export default meta
type Story = StoryObj<typeof InlineCitation>

export const Default: Story = {
  args: {
    index: 1,
    title: 'Tabela de Pedidos',
    url: 'https://erp.example.com/orders',
  },
}

export const WithQuote: Story = {
  args: {
    index: 2,
    title: 'Politica de Devolucao',
    url: 'https://docs.example.com/returns',
    quote: 'Devolucoes devem ser solicitadas em ate 30 dias apos a compra.',
  },
}

export const NoUrl: Story = {
  args: {
    index: 3,
    title: 'Dados internos do sistema',
  },
}

export const InlineUsage: Story = {
  render: () => (
    <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8 }}>
      O pedido #1047 foi atualizado com base na tabela de pedidos{' '}
      <InlineCitation index={1} title="Tabela de Pedidos" url="https://erp.example.com/orders" />
      {' '}e na politica de devolucao{' '}
      <InlineCitation
        index={2}
        title="Politica de Devolucao"
        quote="Devolucoes devem ser solicitadas em ate 30 dias."
      />
      .
    </p>
  ),
}
