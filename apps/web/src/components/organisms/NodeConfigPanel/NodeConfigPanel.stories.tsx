import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { NodeConfigPanel } from './NodeConfigPanel'

const toolOptions = [
  { value: 'buscar_pedido', label: 'buscar_pedido' },
  { value: 'criar_pedido', label: 'criar_pedido' },
  { value: 'calcular_frete', label: 'calcular_frete' },
  { value: 'enviar_email', label: 'enviar_email' },
]

const agentOptions = [
  { value: 'a1', label: 'Agente de Vendas' },
  { value: 'a2', label: 'Agente Financeiro' },
  { value: 'a3', label: 'Agente de Suporte' },
]

const meta: Meta<typeof NodeConfigPanel> = {
  title: 'Organisms/NodeConfigPanel',
  component: NodeConfigPanel,
  tags: ['workflow'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    onSave: fn(),
    onClose: fn(),
    toolOptions,
    agentOptions,
  },
  decorators: [(Story) => <div style={{ height: 500 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof NodeConfigPanel>

/** Action node configured for inference. */
export const ActionInference: Story = {
  args: {
    nodeId: 'action-1',
    nodeLabel: 'Process daily orders',
    initialData: {
      taskType: 'inference',
      agentId: 'a1',
    },
  },
}

/** Action node configured as structured with tool. */
export const ActionStructured: Story = {
  args: {
    nodeId: 'action-2',
    nodeLabel: 'Create invoice',
    initialData: {
      taskType: 'structured',
      toolName: 'criar_pedido',
      agentId: 'a2',
      toolInput: JSON.stringify({ customerId: 'CLI-001', items: [] }, null, 2),
    },
  },
}
