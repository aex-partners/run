import type { Meta, StoryObj } from '@storybook/react'
import { Tool } from './Tool'

const meta: Meta<typeof Tool> = {
  title: 'Molecules/Tool',
  component: Tool,
  tags: ['ai'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    state: { control: 'radio', options: ['input-streaming', 'input-available', 'output-available', 'output-error'] },
    defaultOpen: { control: 'boolean' },
  },
}
export default meta
type Story = StoryObj<typeof Tool>

export const Running: Story = {
  args: {
    toolName: 'query_database',
    state: 'input-available',
    defaultOpen: true,
    input: {
      table: 'pedidos',
      filter: { status: 'pendente', created_after: '2026-01-01' },
      limit: 50,
    },
  },
}

export const Complete: Story = {
  args: {
    toolName: 'search_products',
    state: 'output-available',
    defaultOpen: true,
    input: { query: 'notebook Dell', category: 'eletronicos' },
    output: 'Found 12 products matching "notebook Dell" in category "eletronicos". Top result: Dell Latitude 5540 (R$ 5.299,00)',
  },
}

export const Error: Story = {
  args: {
    toolName: 'send_email',
    state: 'output-error',
    defaultOpen: true,
    input: { to: 'cliente@example.com', subject: 'Confirmacao de pedido' },
    error: 'SMTP connection failed: timeout after 30s. Server smtp.example.com:587 unreachable.',
  },
}

export const InputStreaming: Story = {
  args: {
    toolName: 'generate_report',
    state: 'input-streaming',
    defaultOpen: true,
    input: { type: 'sales', period: 'Q1-2026' },
  },
}

export const Collapsed: Story = {
  args: {
    toolName: 'update_record',
    state: 'output-available',
    defaultOpen: false,
    input: { table: 'clientes', id: 42 },
    output: 'Record updated successfully.',
  },
}

export const MultipleTools: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
      <Tool
        toolName="query_database"
        state="output-available"
        defaultOpen={false}
        input={{ table: 'pedidos' }}
        output="23 records found"
      />
      <Tool
        toolName="calculate_metrics"
        state="input-available"
        defaultOpen={true}
        input={{ metrics: ['revenue', 'margin'] }}
      />
      <Tool
        toolName="send_notification"
        state="output-error"
        defaultOpen={false}
        error="Permission denied"
      />
    </div>
  ),
}
