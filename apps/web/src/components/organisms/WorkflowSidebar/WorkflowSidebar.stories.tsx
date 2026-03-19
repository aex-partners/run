import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { WorkflowSidebar } from './WorkflowSidebar'

const mockWorkflows = [
  { id: 'wf1', name: 'Order Received -> Stock', trigger: 'New sales order', status: 'active' as const },
  { id: 'wf2', name: 'Low Stock Alert', trigger: 'Stock < minimum', status: 'active' as const },
  { id: 'wf3', name: 'Daily Financial Report', trigger: 'Scheduled: 18:00', status: 'active' as const },
  { id: 'wf4', name: 'Proposal Follow-up', trigger: 'Proposal sent + 3 days', status: 'paused' as const },
  { id: 'wf5', name: 'Sync NF-e', trigger: 'Scheduled: every 2h', status: 'active' as const },
]

const meta: Meta<typeof WorkflowSidebar> = {
  title: 'Organisms/WorkflowSidebar',
  component: WorkflowSidebar,
  tags: ['workflow'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onSelect: { action: 'selected' },
    onNew: { action: 'new' },
    onToggleStatus: { action: 'toggle-status' },
    onDelete: { action: 'deleted' },
  },
  args: {
    onSelect: fn(),
    onNew: fn(),
    onToggleStatus: fn(),
    onDelete: fn(),
  },
  decorators: [(Story) => <div style={{ width: 240, height: 500, background: 'var(--surface)', border: '1px solid var(--border)' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof WorkflowSidebar>

/** Type in the search box to filter workflows. Hover any item to see pause/delete buttons. */
export const Default: Story = {
  args: { workflows: mockWorkflows, activeId: 'wf1' },
}

export const Empty: Story = {
  args: { workflows: [] },
}

/** Type "Low" in the search box to filter the list to matching workflows. */
export const SearchInteraction: Story = {
  args: {
    workflows: [
      { id: 'wf1', name: 'Order Received -> Stock', trigger: 'New sales order', status: 'active' as const },
      { id: 'wf2', name: 'Low Stock Alert', trigger: 'Stock < minimum', status: 'active' as const },
      { id: 'wf3', name: 'Daily Financial Report', trigger: 'Scheduled: 18:00', status: 'active' as const },
      { id: 'wf4', name: 'Low Inventory Warning', trigger: 'Inventory < threshold', status: 'paused' as const },
      { id: 'wf5', name: 'Sync NF-e', trigger: 'Scheduled: every 2h', status: 'active' as const },
    ],
  },
}

export const AllPaused: Story = {
  args: {
    workflows: [
      { id: 'wf1', name: 'Order Received -> Stock', trigger: 'New sales order', status: 'paused' as const },
      { id: 'wf2', name: 'Low Stock Alert', trigger: 'Stock < minimum', status: 'paused' as const },
      { id: 'wf3', name: 'Daily Financial Report', trigger: 'Scheduled: 18:00', status: 'paused' as const },
    ],
  },
}

export const SingleWorkflow: Story = {
  args: {
    workflows: [
      { id: 'wf1', name: 'Order Received -> Stock', trigger: 'New sales order', status: 'active' as const },
    ],
    activeId: 'wf1',
  },
}
