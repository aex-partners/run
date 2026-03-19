import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { CustomToolCard } from './CustomToolCard'

const meta: Meta<typeof CustomToolCard> = {
  title: 'Molecules/CustomToolCard',
  component: CustomToolCard,
  tags: ['agent-config'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    type: { control: 'select', options: ['http', 'query', 'code', 'composite'] },
    onEdit: { action: 'edit' },
    onDelete: { action: 'delete' },
    onTest: { action: 'test' },
  },
  args: { onEdit: fn(), onDelete: fn(), onTest: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 540 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof CustomToolCard>

/** HTTP tool calling an external API. */
export const HttpType: Story = {
  args: {
    id: 'ct1',
    name: 'buscar_pedido',
    description: 'Busca pedido por ID no sistema de vendas',
    type: 'http',
  },
}

/** Code tool running a JavaScript function. */
export const CodeType: Story = {
  args: {
    id: 'ct2',
    name: 'calcular_frete',
    description: 'Calcula frete com base no CEP e peso',
    type: 'code',
  },
}

/** Query tool executing a database query. */
export const QueryType: Story = {
  args: {
    id: 'ct3',
    name: 'relatorio_vendas',
    description: 'Gera relatorio de vendas do periodo',
    type: 'query',
  },
}

/** Composite tool combining multiple sub-tools. */
export const CompositeType: Story = {
  args: {
    id: 'ct4',
    name: 'processar_nfe',
    description: 'Emite NF-e e envia por email ao cliente',
    type: 'composite',
  },
}

/** Tool linked to an integration. */
export const WithIntegration: Story = {
  args: {
    id: 'ct5',
    name: 'enviar_whatsapp',
    description: 'Envia mensagem via WhatsApp Business API',
    type: 'http',
    integrationName: 'WhatsApp Business',
  },
}
