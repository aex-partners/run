import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { AgentCard } from './AgentCard'

const meta: Meta<typeof AgentCard> = {
  title: 'Molecules/AgentCard',
  component: AgentCard,
  tags: ['agent-config'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onEdit: { action: 'edit' },
    onDelete: { action: 'delete' },
  },
  args: { onEdit: fn(), onDelete: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 500 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof AgentCard>

/** Default agent card with skills and tools count. Hover to see edit/delete actions. */
export const Default: Story = {
  args: {
    id: 'a1',
    name: 'Agente de Vendas',
    description: 'Gerencia pedidos, clientes e propostas comerciais',
    skillCount: 3,
    toolCount: 5,
  },
}

/** Agent with a custom avatar URL. */
export const WithAvatar: Story = {
  args: {
    id: 'a2',
    name: 'Agente Financeiro',
    description: 'Contas a pagar, receber e conciliacao bancaria',
    avatar: '',
    skillCount: 2,
    toolCount: 8,
  },
}

/** Agent without description. */
export const NoDescription: Story = {
  args: {
    id: 'a3',
    name: 'Agente de Suporte',
    skillCount: 1,
    toolCount: 2,
  },
}
