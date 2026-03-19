import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { AgentForm } from './AgentForm'

const skillOptions = [
  { value: 's1', label: 'Gestao de Pedidos' },
  { value: 's2', label: 'Atendimento ao Cliente' },
  { value: 's3', label: 'Financeiro' },
]

const toolOptions = [
  { value: 't1', label: 'buscar_pedido' },
  { value: 't2', label: 'criar_pedido' },
  { value: 't3', label: 'enviar_email' },
  { value: 't4', label: 'calcular_frete' },
]

const meta: Meta<typeof AgentForm> = {
  title: 'Organisms/AgentForm',
  component: AgentForm,
  tags: ['agent-config'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onSubmit: { action: 'submitted' },
    onCancel: { action: 'cancelled' },
  },
  args: {
    onSubmit: fn(),
    onCancel: fn(),
    skillOptions,
    toolOptions,
  },
  decorators: [(Story) => <div style={{ width: 480, padding: 24, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof AgentForm>

/** Empty form for creating a new agent. */
export const CreateMode: Story = { args: {} }

/** Pre-filled form for editing an existing agent. */
export const EditMode: Story = {
  args: {
    initialData: {
      name: 'Agente de Vendas',
      description: 'Gerencia pedidos, clientes e propostas',
      systemPrompt: 'Voce e um assistente especializado em vendas. Ajude o usuario a gerenciar pedidos e clientes.',
      modelId: 'gpt-4o',
      skillIds: ['s1', 's2'],
      toolIds: ['t1', 't2', 't3'],
      internetAccess: false,
    },
  },
}

/** Eric (default agent) with internet access enabled. */
export const EricDefault: Story = {
  args: {
    initialData: {
      name: 'Eric',
      description: 'Your AI-powered ERP assistant. Eric helps manage tasks, query data, create entities, and automate workflows.',
      systemPrompt: 'You are Eric, the default AI assistant for RUN ERP. You help users manage their business data, run tasks, and automate workflows.',
      modelId: '',
      skillIds: ['s1'],
      toolIds: ['t1', 't2'],
      internetAccess: true,
    },
  },
}
