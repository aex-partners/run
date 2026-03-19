import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Suggestion } from './Suggestion'

const meta: Meta<typeof Suggestion> = {
  title: 'Molecules/Suggestion',
  component: Suggestion,
  tags: ['ai'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onSelect: { action: 'selected' },
  },
  args: { onSelect: fn() },
}
export default meta
type Story = StoryObj<typeof Suggestion>

export const Default: Story = {
  args: {
    suggestions: ['Ver estoque', 'Listar pedidos', 'Gerar relatorio'],
  },
}

export const ManySuggestions: Story = {
  args: {
    suggestions: [
      'Verificar estoque',
      'Listar pedidos pendentes',
      'Gerar relatorio de vendas',
      'Consultar NF-e',
      'Agendar entrega',
      'Falar com suporte',
    ],
  },
}

export const SingleSuggestion: Story = {
  args: {
    suggestions: ['Confirmar pedido'],
  },
}
