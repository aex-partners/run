import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Textarea } from './Textarea'

const meta: Meta<typeof Textarea> = {
  title: 'Atoms/Textarea',
  component: Textarea,
  tags: ['form-control'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    monospace: { control: 'boolean' },
    disabled: { control: 'boolean' },
    rows: { control: { type: 'number', min: 2, max: 12 } },
    onChange: { action: 'changed' },
  },
  args: { onChange: fn() },
  decorators: [(Story) => <div style={{ width: 360 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof Textarea>

/** Default multi-line text input. */
export const Default: Story = { args: { placeholder: 'Enter a description...' } }

/** Monospace font for code or JSON editing. */
export const Monospace: Story = {
  args: {
    monospace: true,
    value: '{\n  "name": "get_orders",\n  "type": "object"\n}',
    rows: 6,
  },
}

/** Error state with validation message. */
export const WithError: Story = {
  args: {
    value: 'Invalid content',
    error: 'This field is required and must be valid JSON.',
  },
}

/** Disabled state. */
export const Disabled: Story = {
  args: {
    value: 'Read-only content here',
    disabled: true,
  },
}
