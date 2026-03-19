import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { FormSidebar } from './FormSidebar'

const meta: Meta<typeof FormSidebar> = {
  title: 'Molecules/FormSidebar',
  component: FormSidebar,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    onFormSelect: fn(),
    onNewForm: fn(),
    onRenameForm: fn(),
    onDeleteForm: fn(),
    onCopyLink: fn(),
  },
  decorators: [(Story) => <div style={{ height: 500, width: 240 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof FormSidebar>

export const WithForms: Story = {
  args: {
    forms: [
      { id: '1', name: 'Cadastro de Clientes', isPublic: true, publicToken: 'abc-123' },
      { id: '2', name: 'Pedido de Compra', isPublic: false },
      { id: '3', name: 'Feedback do Produto', isPublic: true, publicToken: 'def-456' },
    ],
    activeFormId: '1',
  },
}

export const Empty: Story = {
  args: {
    forms: [],
  },
}
