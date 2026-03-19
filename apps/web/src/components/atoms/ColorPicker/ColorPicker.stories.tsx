import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { ColorPicker } from './ColorPicker'

const meta: Meta<typeof ColorPicker> = {
  title: 'Atoms/ColorPicker',
  component: ColorPicker,
  tags: ['form-control'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onChange: { action: 'colorChanged' },
  },
  args: { onChange: fn() },
  decorators: [(Story) => <div style={{ width: 300 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof ColorPicker>

/** Default color picker with standard presets. */
export const Default: Story = { args: { label: 'Accent Color' } }

/** Custom preset colors. */
export const CustomPresets: Story = {
  args: { label: 'Brand Color', presets: ['#1e40af', '#7c3aed', '#be185d', '#0f766e', '#b45309'] },
}

/** A color already selected — shows outline ring. */
export const PreSelected: Story = {
  args: { label: 'Accent Color', value: '#EA580C' },
}
