import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { IntegrationForm } from './IntegrationForm'

const meta: Meta<typeof IntegrationForm> = {
  title: 'Organisms/IntegrationForm',
  component: IntegrationForm,
  tags: ['agent-config'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    onSubmit: fn(),
    onCancel: fn(),
    onOAuthConnect: fn(),
  },
  decorators: [(Story) => <div style={{ width: 480, padding: 24, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', maxHeight: '90vh', overflow: 'auto' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof IntegrationForm>

/** Empty form for creating a REST integration. */
export const RestCreate: Story = { args: {} }

/** OAuth2 form with connect button. */
export const OAuth2Create: Story = {
  args: {
    initialData: {
      type: 'oauth2',
      name: 'Google Sheets',
      description: 'Sincronizar dados com planilhas Google',
    },
  },
}

/** Editing an existing webhook integration. */
export const WebhookEdit: Story = {
  args: {
    initialData: {
      name: 'Mercado Livre',
      description: 'Recebe notificacoes de novos pedidos e atualizacoes',
      type: 'webhook',
      webhookSecret: 'whsec_abc123def456',
    },
  },
}
