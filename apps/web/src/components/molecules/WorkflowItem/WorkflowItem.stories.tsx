import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { WorkflowItem } from './WorkflowItem'

const meta: Meta<typeof WorkflowItem> = {
  title: 'Molecules/WorkflowItem',
  component: WorkflowItem,
  tags: ['workflow'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    status: { control: 'select', options: ['active', 'paused'] },
    active: { control: 'boolean' },
    onClick: { action: 'clicked' },
  },
  args: {
    onClick: fn(),
    onToggleStatus: fn(),
    onDelete: fn(),
  },
  decorators: [(Story) => <div style={{ width: 240, background: 'var(--surface)' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof WorkflowItem>

/** Workflow that is running (status=active) but not currently selected in the list (active=false). */
export const Active: Story = {
  args: { name: 'Order Received', trigger: 'New sales order', status: 'active', active: false },
}

/** Workflow that is running and currently selected — shows the accent highlight and chevron. */
export const Selected: Story = {
  args: { name: 'Order Received', trigger: 'New sales order', status: 'active', active: true },
}

/** Workflow that is paused and not selected. */
export const Paused: Story = {
  args: { name: 'Proposal Follow-up', trigger: 'Proposal sent + 3 days', status: 'paused', active: false },
}

/** Paused workflow that is currently selected. */
export const PausedSelected: Story = {
  args: { name: 'Proposal Follow-up', trigger: 'Proposal sent + 3 days', status: 'paused', active: true },
}

/**
 * Hover the card to reveal the toggle (pause/resume) and delete buttons in the
 * right-hand action area. The toggle button is also visible when the item is
 * selected (active=true).
 */
export const HoverInteraction: Story = {
  args: { name: 'Low Stock Alert', trigger: 'Stock below threshold', status: 'active', active: false },
}
