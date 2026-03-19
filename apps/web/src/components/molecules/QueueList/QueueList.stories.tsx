import type { Meta, StoryObj } from '@storybook/react'
import { QueueList } from './QueueList'

const meta: Meta<typeof QueueList> = {
  title: 'Molecules/QueueList',
  component: QueueList,
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
type Story = StoryObj<typeof QueueList>

export const Default: Story = {
  args: {
    defaultOpen: true,
    sections: [
      {
        title: 'Validacoes',
        items: [
          { id: '1', content: 'Verificar CNPJ duplicado', completed: true },
          { id: '2', content: 'Validar endereco', completed: true },
          { id: '3', content: 'Checar limite de credito', completed: false },
        ],
      },
      {
        title: 'Atualizacoes',
        items: [
          { id: '4', content: 'Atualizar cadastro do cliente', description: 'Tabela: clientes', completed: false },
          { id: '5', content: 'Recalcular precos', description: 'Tabela: tabela_precos', completed: false },
        ],
      },
    ],
  },
}

export const AllCompleted: Story = {
  args: {
    defaultOpen: true,
    sections: [
      {
        title: 'Tarefas',
        items: [
          { id: '1', content: 'Backup realizado', completed: true },
          { id: '2', content: 'Indices reconstruidos', completed: true },
          { id: '3', content: 'Cache limpo', completed: true },
        ],
      },
    ],
  },
}

export const Collapsed: Story = {
  args: {
    defaultOpen: false,
    sections: [
      {
        title: 'Pendencias',
        items: [
          { id: '1', content: 'Item A', completed: false },
          { id: '2', content: 'Item B', completed: false },
        ],
      },
    ],
  },
}
