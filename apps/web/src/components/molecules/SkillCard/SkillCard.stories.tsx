import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { SkillCard } from './SkillCard'

const meta: Meta<typeof SkillCard> = {
  title: 'Molecules/SkillCard',
  component: SkillCard,
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
type Story = StoryObj<typeof SkillCard>

/** Default skill card with tools. */
export const Default: Story = {
  args: {
    id: 'sk1',
    name: 'Gestao de Pedidos',
    description: 'Cria, consulta e atualiza pedidos de venda',
    toolCount: 4,
  },
}

/** Skill with guardrails enabled. */
export const WithGuardrails: Story = {
  args: {
    id: 'sk2',
    name: 'Financeiro',
    description: 'Contas a pagar e receber com aprovacao obrigatoria',
    toolCount: 6,
    hasGuardrails: true,
  },
}

/** Skill without guardrails. */
export const NoGuardrails: Story = {
  args: {
    id: 'sk3',
    name: 'Consulta de Estoque',
    description: 'Consulta saldos e movimentacoes',
    toolCount: 2,
    hasGuardrails: false,
  },
}
