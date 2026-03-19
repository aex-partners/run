import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Toggle } from './Toggle'

const meta: Meta<typeof Toggle> = {
  title: 'Atoms/Toggle',
  component: Toggle,
  tags: ['form-control'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    size: { control: 'select', options: ['sm', 'md'] },
    onChange: { action: 'toggled' },
  },
  args: { onChange: fn() },
}
export default meta
type Story = StoryObj<typeof Toggle>

/** Default unchecked toggle. */
export const Default: Story = { args: { checked: false } }

/** Checked (on) state with accent background. */
export const Checked: Story = { args: { checked: true } }

/** Disabled state at 50% opacity, non-interactive. */
export const Disabled: Story = { args: { checked: false, disabled: true } }

/** Small variant for compact layouts. */
export const Small: Story = { args: { checked: true, size: 'sm' } }
