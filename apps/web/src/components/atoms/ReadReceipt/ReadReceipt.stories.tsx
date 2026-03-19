import type { Meta, StoryObj } from '@storybook/react'
import { ReadReceipt } from './ReadReceipt'

const meta: Meta<typeof ReadReceipt> = {
  title: 'Atoms/ReadReceipt',
  component: ReadReceipt,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    status: { control: 'select', options: ['sent', 'delivered', 'read'] },
  },
}
export default meta
type Story = StoryObj<typeof ReadReceipt>

export const Sent: Story = {
  args: { status: 'sent' },
}

export const Delivered: Story = {
  args: { status: 'delivered' },
}

export const Read: Story = {
  args: { status: 'read' },
}
