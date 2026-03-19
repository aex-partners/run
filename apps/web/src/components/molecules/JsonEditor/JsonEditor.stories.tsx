import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { JsonEditor } from './JsonEditor'

const meta: Meta<typeof JsonEditor> = {
  title: 'Molecules/JsonEditor',
  component: JsonEditor,
  tags: ['form-control'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    disabled: { control: 'boolean' },
    onChange: { action: 'changed' },
  },
  args: { onChange: fn() },
  decorators: [(Story) => <div style={{ width: 400 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof JsonEditor>

/** Valid JSON input schema. */
export const ValidJson: Story = {
  args: {
    value: JSON.stringify({ type: 'object', properties: { orderId: { type: 'string' }, amount: { type: 'number' } }, required: ['orderId'] }, null, 2),
  },
}

/** Invalid JSON: blur the field to see the validation error. */
export const InvalidJson: Story = {
  args: {
    value: '{ "name": "test", }',
  },
}

/** Empty editor with placeholder. */
export const Empty: Story = {
  args: { value: '' },
}
