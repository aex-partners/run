import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { CustomToolForm } from './CustomToolForm'

const integrationOptions = [
  { value: 'int1', label: 'SEFAZ NF-e' },
  { value: 'int2', label: 'WhatsApp Business' },
]

const meta: Meta<typeof CustomToolForm> = {
  title: 'Organisms/CustomToolForm',
  component: CustomToolForm,
  tags: ['agent-config'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    onSubmit: fn(),
    onCancel: fn(),
    onTest: fn(),
    integrationOptions,
  },
  decorators: [(Story) => <div style={{ width: 520, padding: 24, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', maxHeight: '90vh', overflow: 'auto' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof CustomToolForm>

/** Empty form for creating an HTTP tool. */
export const HttpCreate: Story = { args: {} }

/** Pre-filled form for editing a code tool. */
export const CodeEdit: Story = {
  args: {
    initialData: {
      name: 'calcular_frete',
      description: 'Calcula frete com base no CEP de origem e destino',
      type: 'code',
      inputSchema: JSON.stringify({ type: 'object', properties: { cepOrigem: { type: 'string' }, cepDestino: { type: 'string' }, peso: { type: 'number' } }, required: ['cepOrigem', 'cepDestino'] }, null, 2),
      config: JSON.stringify({ runtime: 'node18' }, null, 2),
      isReadOnly: true,
    },
  },
}

/** Form showing a successful test result. */
export const WithTestResult: Story = {
  args: {
    initialData: {
      name: 'buscar_pedido',
      description: 'Busca pedido por ID',
      type: 'http',
      inputSchema: '{\n  "type": "object",\n  "properties": {\n    "orderId": { "type": "string" }\n  }\n}',
      config: '{\n  "url": "https://api.example.com/orders/:orderId",\n  "method": "GET"\n}',
      isReadOnly: true,
    },
    testResult: {
      success: true,
      result: JSON.stringify({ id: 'PED-001', status: 'approved', total: 1250.00 }, null, 2),
    },
  },
}
