import type { Meta, StoryObj } from '@storybook/react'
import { Sources } from './Sources'

const meta: Meta<typeof Sources> = {
  title: 'Molecules/Sources',
  component: Sources,
  tags: ['ai'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    defaultOpen: { control: 'boolean' },
  },
}
export default meta
type Story = StoryObj<typeof Sources>

export const Default: Story = {
  args: {
    defaultOpen: true,
    sources: [
      { id: '1', name: 'pedidos', description: 'Tabela de pedidos de venda' },
      { id: '2', name: 'clientes', description: 'Cadastro de clientes' },
      { id: '3', name: 'produtos', description: 'Catalogo de produtos' },
    ],
  },
}

export const WithUrls: Story = {
  args: {
    defaultOpen: true,
    sources: [
      { id: '1', name: 'API de Frete', description: 'Consulta de precos de frete', url: 'https://api.example.com/shipping' },
      { id: '2', name: 'tabela_frete', description: 'Regras de frete por regiao' },
    ],
  },
}

export const SingleSource: Story = {
  args: {
    defaultOpen: true,
    sources: [
      { id: '1', name: 'estoque', description: 'Tabela de estoque atual' },
    ],
  },
}

export const Collapsed: Story = {
  args: {
    defaultOpen: false,
    sources: [
      { id: '1', name: 'pedidos' },
      { id: '2', name: 'clientes' },
    ],
  },
}
