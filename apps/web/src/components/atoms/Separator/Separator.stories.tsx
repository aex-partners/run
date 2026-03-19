import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Separator } from './Separator'

const meta: Meta<typeof Separator> = {
  title: 'Atoms/Separator',
  component: Separator,
  tags: ['display'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    orientation: { control: 'select', options: ['horizontal', 'vertical'] },
  },
}
export default meta
type Story = StoryObj<typeof Separator>

/** Full-width horizontal rule — role="separator" aria-orientation="horizontal". */
export const Horizontal: Story = {
  args: { orientation: 'horizontal' },
  decorators: [(Story) => <div style={{ width: 300 }}><Story /></div>],
}

/** Vertical divider — useful between inline items; aria-orientation="vertical". */
export const Vertical: Story = {
  args: { orientation: 'vertical' },
  decorators: [(Story) => <div style={{ height: 60 }}><Story /></div>],
}
