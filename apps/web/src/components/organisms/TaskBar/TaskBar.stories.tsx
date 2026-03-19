import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { TaskBar } from './TaskBar'
import type { Task } from '../TaskList/TaskList'

const mockTasks: Task[] = [
  { id: '1', title: 'Processar importacao de fornecedores', description: 'Lendo planilha Excel e validando dados', status: 'running', agent: 'Import Agent', startTime: '2 min ago', progress: 65, taskType: 'structured', conversationId: 'conv-1' },
  { id: '2', title: 'Gerar relatorio mensal de vendas', status: 'pending', agent: 'Sales Agent', startTime: '5 min ago', taskType: 'inference', conversationId: 'conv-1' },
  { id: '3', title: 'Sincronizar estoque com ERP', description: 'Erro na conexao com API externa', status: 'failed', agent: 'Stock Agent', startTime: '10 min ago', duration: '3m 22s', conversationId: 'conv-2' },
  { id: '4', title: 'Backup do banco de dados', status: 'completed', agent: 'System Agent', startTime: '30 min ago', duration: '5m 10s', conversationId: 'conv-2' },
  { id: '5', title: 'Enviar notificacoes de cobranca', status: 'cancelled', agent: 'Finance Agent', startTime: '1h ago', conversationId: 'conv-1' },
]

const meta: Meta<typeof TaskBar> = {
  title: 'Organisms/TaskBar',
  component: TaskBar,
  tags: ['task'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    onClose: fn(),
    onCancel: fn(),
    onRetry: fn(),
    onViewLogs: fn(),
    onTaskClick: fn(),
    onScopeChange: fn(),
  },
  decorators: [(Story) => <div style={{ height: 500, display: 'flex', justifyContent: 'flex-end', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof TaskBar>

export const WithTasks: Story = {
  args: {
    tasks: mockTasks,
    isOpen: true,
    activeConversationId: 'conv-1',
  },
}

export const Empty: Story = {
  args: {
    tasks: [],
    isOpen: true,
  },
}

export const Closed: Story = {
  args: {
    tasks: mockTasks,
    isOpen: false,
  },
}

export const FilteredByChat: Story = {
  args: {
    tasks: mockTasks,
    isOpen: true,
    activeConversationId: 'conv-1',
    scope: 'this-chat',
  },
}

export const AllScope: Story = {
  args: {
    tasks: mockTasks,
    isOpen: true,
    activeConversationId: 'conv-1',
    scope: 'all',
  },
}
