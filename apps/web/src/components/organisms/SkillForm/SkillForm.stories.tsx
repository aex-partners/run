import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { SkillForm } from './SkillForm'

const toolOptions = [
  { value: 't1', label: 'buscar_pedido' },
  { value: 't2', label: 'criar_pedido' },
  { value: 't3', label: 'atualizar_pedido' },
]

const systemToolOptions = [
  { value: 'createEntity', label: 'createEntity' },
  { value: 'queryEntities', label: 'queryEntities' },
  { value: 'updateEntity', label: 'updateEntity' },
  { value: 'deleteEntity', label: 'deleteEntity' },
]

const meta: Meta<typeof SkillForm> = {
  title: 'Organisms/SkillForm',
  component: SkillForm,
  tags: ['agent-config'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    onSubmit: fn(),
    onCancel: fn(),
    toolOptions,
    systemToolOptions,
  },
  decorators: [(Story) => <div style={{ width: 480, padding: 24, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof SkillForm>

/** Empty form for creating a new skill. */
export const CreateMode: Story = { args: {} }

/** Pre-filled form for editing an existing skill with guardrails. */
export const EditMode: Story = {
  args: {
    initialData: {
      name: 'Gestao de Pedidos',
      description: 'Cria, consulta e atualiza pedidos de venda',
      systemPrompt: 'Voce gerencia pedidos. Sempre confirme valores acima de R$ 10.000.',
      toolIds: ['t1', 't2'],
      systemToolNames: ['queryEntities'],
      guardrails: {
        maxSteps: 10,
        requireConfirmation: true,
      },
    },
  },
}
