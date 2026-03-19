import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { TaskList } from './TaskList'

const mockTasks = [
  { id: 't1', title: 'Process daily orders', description: 'Checking 12 new orders and updating stock', agent: 'Sales Agent', status: 'running' as const, startTime: '14:30', duration: '2m 34s', progress: 65 },
  { id: 't2', title: 'Stock reconciliation', description: 'Comparing system vs physical for 48 SKUs', agent: 'Stock Agent', status: 'running' as const, startTime: '14:28', duration: '4m 12s', progress: 40 },
  { id: 't5', title: 'Update catalog prices', description: 'Waiting for manager approval', agent: 'Sales Agent', status: 'pending' as const, startTime: '—' },
  { id: 't6', title: 'Import supplier invoices', description: 'XML available, waiting in queue', agent: 'Stock Agent', status: 'pending' as const, startTime: '—' },
  { id: 't7', title: 'Generate daily invoices', agent: 'Finance Agent', status: 'completed' as const, startTime: '13:00', duration: '1m 45s' },
  { id: 't8', title: 'Send proposal to Acme', agent: 'Sales Agent', status: 'completed' as const, startTime: '12:30', duration: '0m 52s' },
  { id: 't11', title: 'Sync with external ERP', description: 'Error: API connection timeout', agent: 'System', status: 'failed' as const, startTime: '10:30', duration: '0m 12s' },
]

const meta: Meta<typeof TaskList> = {
  title: 'Organisms/TaskList',
  component: TaskList,
  tags: ['task'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    filter: { control: 'select', options: ['all', 'running', 'pending', 'completed', 'failed'] },
    onFilterChange: { action: 'filter-change' },
  },
  args: {
    onFilterChange: fn(),
    onCancel: fn(),
    onRetry: fn(),
    onViewLogs: fn(),
  },
  decorators: [(Story) => <div style={{ height: 500, display: 'flex', flexDirection: 'column' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof TaskList>

/** Click group headers to collapse/expand. Use filter pills at top to filter by status. */
export const Default: Story = {
  args: { tasks: mockTasks, filter: 'all' },
}

/** Click filter pills to change the active filter. Only running tasks are shown. */
export const FilteredByRunning: Story = {
  args: { tasks: mockTasks, filter: 'running' },
}

/** Only pending tasks are shown — tasks awaiting a trigger or approval. */
export const FilteredByPending: Story = {
  args: { tasks: mockTasks, filter: 'pending' },
}

/** Only completed tasks from today are shown. */
export const FilteredByCompleted: Story = {
  args: { tasks: mockTasks, filter: 'completed' },
}

/** All task action callbacks (onCancel, onRetry, onViewLogs) are wired up — check the Actions panel. */
export const WithTaskActions: Story = {
  args: {
    tasks: mockTasks,
    filter: 'all',
    onCancel: fn(),
    onRetry: fn(),
    onViewLogs: fn(),
  },
}

export const Empty: Story = {
  args: { tasks: [], filter: 'all' },
}
