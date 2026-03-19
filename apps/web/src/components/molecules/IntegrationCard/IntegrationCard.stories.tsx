import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { IntegrationCard } from './IntegrationCard'

const meta: Meta<typeof IntegrationCard> = {
  title: 'Molecules/IntegrationCard',
  component: IntegrationCard,
  tags: ['agent-config'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    type: { control: 'select', options: ['rest', 'oauth2', 'webhook'] },
    enabled: { control: 'boolean' },
    onToggle: { action: 'toggled' },
    onConfigure: { action: 'configure' },
  },
  args: { onToggle: fn(), onConfigure: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof IntegrationCard>

/** REST API integration, enabled. */
export const RestEnabled: Story = {
  args: {
    id: 'int1',
    name: 'SEFAZ NF-e',
    description: 'Emissao e consulta de notas fiscais eletronicas',
    type: 'rest',
    enabled: true,
  },
}

/** OAuth2 integration, disabled. */
export const OAuth2Disabled: Story = {
  args: {
    id: 'int2',
    name: 'Google Sheets',
    description: 'Sincronizacao de dados com planilhas Google',
    type: 'oauth2',
    enabled: false,
  },
}

/** Webhook integration, enabled. */
export const WebhookEnabled: Story = {
  args: {
    id: 'int3',
    name: 'Mercado Livre',
    description: 'Recebe notificacoes de novos pedidos',
    type: 'webhook',
    enabled: true,
  },
}
