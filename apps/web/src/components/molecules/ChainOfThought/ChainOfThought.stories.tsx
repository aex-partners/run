import type { Meta, StoryObj } from '@storybook/react'
import { ChainOfThought } from './ChainOfThought'

const meta: Meta<typeof ChainOfThought> = {
  title: 'Molecules/ChainOfThought',
  component: ChainOfThought,
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
type Story = StoryObj<typeof ChainOfThought>

export const InProgress: Story = {
  args: {
    defaultOpen: true,
    steps: [
      { id: '1', label: 'Consultando tabela de pedidos', status: 'complete' },
      { id: '2', label: 'Filtrando por periodo', status: 'complete' },
      { id: '3', label: 'Calculando metricas', status: 'active' },
      { id: '4', label: 'Gerando relatorio', status: 'pending' },
    ],
  },
}

export const AllComplete: Story = {
  args: {
    defaultOpen: true,
    steps: [
      { id: '1', label: 'Analisando requisicao', status: 'complete' },
      { id: '2', label: 'Buscando dados no banco', status: 'complete' },
      { id: '3', label: 'Formatando resposta', status: 'complete' },
    ],
  },
}

export const WithDescriptions: Story = {
  args: {
    defaultOpen: true,
    steps: [
      { id: '1', label: 'Identificar entidades', description: 'Extraindo nomes de tabelas da pergunta do usuario', status: 'complete' },
      { id: '2', label: 'Consultar schema', description: 'Verificando colunas e tipos de dados', status: 'active' },
      { id: '3', label: 'Montar query', description: 'Gerando SQL otimizado', status: 'pending' },
    ],
  },
}

export const Collapsed: Story = {
  args: {
    defaultOpen: false,
    steps: [
      { id: '1', label: 'Step 1', status: 'complete' },
      { id: '2', label: 'Step 2', status: 'complete' },
      { id: '3', label: 'Step 3', status: 'active' },
    ],
  },
}
