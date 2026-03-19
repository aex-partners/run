import type { Meta, StoryObj } from '@storybook/react'
import { Reasoning } from './Reasoning'

const meta: Meta<typeof Reasoning> = {
  title: 'Molecules/Reasoning',
  component: Reasoning,
  tags: ['ai'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    isStreaming: { control: 'boolean' },
    defaultOpen: { control: 'boolean' },
  },
}
export default meta
type Story = StoryObj<typeof Reasoning>

export const Default: Story = {
  args: {
    content: 'Analisando a tabela de pedidos para encontrar os itens com maior margem de lucro no trimestre atual...',
    defaultOpen: true,
  },
}

export const Streaming: Story = {
  args: {
    content: 'Consultando a base de dados de fornecedores...',
    isStreaming: true,
  },
}

export const LongContent: Story = {
  args: {
    content: `Passo 1: Consultando tabela de pedidos (orders)
Passo 2: Filtrando por periodo Q1 2026
Passo 3: Calculando margem por produto
Passo 4: Ordenando por margem decrescente
Passo 5: Selecionando top 10 produtos`,
    defaultOpen: true,
  },
}

export const Collapsed: Story = {
  args: {
    content: 'Conteudo do raciocinio que so aparece quando expandido.',
    defaultOpen: false,
  },
}
