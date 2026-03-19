import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { MultiSelect } from './MultiSelect'

const skillOptions = [
  { value: 's1', label: 'Atendimento ao Cliente' },
  { value: 's2', label: 'Gestao de Estoque' },
  { value: 's3', label: 'Financeiro' },
  { value: 's4', label: 'Vendas' },
  { value: 's5', label: 'Logistica' },
  { value: 's6', label: 'Compras' },
  { value: 's7', label: 'RH' },
]

const meta: Meta<typeof MultiSelect> = {
  title: 'Molecules/MultiSelect',
  component: MultiSelect,
  tags: ['form-control'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    disabled: { control: 'boolean' },
    onChange: { action: 'changed' },
  },
  args: { onChange: fn(), options: skillOptions },
  decorators: [(Story) => <div style={{ width: 320 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof MultiSelect>

/** No items selected. Click to open dropdown. */
export const Empty: Story = {
  args: { selected: [], placeholder: 'Select skills...' },
}

/** A few items selected, shown as pills. */
export const FewSelected: Story = {
  args: { selected: ['s1', 's3'], placeholder: 'Select skills...' },
}

/** Many items with search filtering. */
export const ManyWithSearch: Story = {
  args: { selected: ['s1', 's2', 's3', 's4', 's5'], placeholder: 'Select skills...' },
}

/** Disabled state. */
export const Disabled: Story = {
  args: { selected: ['s1'], disabled: true, placeholder: 'Select skills...' },
}
