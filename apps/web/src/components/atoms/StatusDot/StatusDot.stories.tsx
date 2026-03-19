import type { Meta, StoryObj } from '@storybook/react'
import { StatusDot } from './StatusDot'

const meta: Meta<typeof StatusDot> = {
  title: 'Atoms/StatusDot',
  component: StatusDot,
  tags: ['display'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    variant: { control: 'select', options: ['active', 'paused', 'error', 'pending'] },
  },
}
export default meta
type Story = StoryObj<typeof StatusDot>

export const Default: Story = { args: { variant: 'active' } }
export const Active: Story = { args: { variant: 'active', label: 'Active' } }
export const Paused: Story = { args: { variant: 'paused', label: 'Paused' } }
export const Error: Story = { args: { variant: 'error', label: 'Error' } }
export const Pending: Story = { args: { variant: 'pending', label: 'Pending' } }
