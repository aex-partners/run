import type { Meta, StoryObj } from '@storybook/react'
import { PlanCard } from './PlanCard'

const meta: Meta<typeof PlanCard> = {
  title: 'Molecules/PlanCard',
  component: PlanCard,
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
type Story = StoryObj<typeof PlanCard>

export const InProgress: Story = {
  args: {
    title: 'Importar dados de fornecedores',
    description: 'Importando planilha Excel para a tabela de fornecedores.',
    defaultOpen: true,
    steps: [
      { id: '1', label: 'Ler arquivo Excel', status: 'complete' },
      { id: '2', label: 'Validar formato das colunas', status: 'complete' },
      { id: '3', label: 'Inserir registros no banco', status: 'active' },
      { id: '4', label: 'Verificar duplicatas', status: 'pending' },
      { id: '5', label: 'Gerar relatorio de importacao', status: 'pending' },
    ],
  },
}

export const WithError: Story = {
  args: {
    title: 'Sincronizar estoque',
    defaultOpen: true,
    steps: [
      { id: '1', label: 'Conectar com ERP externo', status: 'complete' },
      { id: '2', label: 'Baixar dados de estoque', status: 'error' },
      { id: '3', label: 'Atualizar tabela local', status: 'pending' },
    ],
  },
}

export const AllComplete: Story = {
  args: {
    title: 'Gerar relatorio mensal',
    defaultOpen: true,
    steps: [
      { id: '1', label: 'Coletar dados de vendas', status: 'complete' },
      { id: '2', label: 'Calcular metricas', status: 'complete' },
      { id: '3', label: 'Formatar PDF', status: 'complete' },
    ],
  },
}

export const StreamingEmpty: Story = {
  args: {
    title: 'Planejando execucao...',
    isStreaming: true,
    defaultOpen: true,
    steps: [],
  },
}

export const Collapsed: Story = {
  args: {
    title: 'Migrar tabela de clientes',
    defaultOpen: false,
    steps: [
      { id: '1', label: 'Backup', status: 'complete' },
      { id: '2', label: 'Migrar', status: 'active' },
    ],
  },
}
