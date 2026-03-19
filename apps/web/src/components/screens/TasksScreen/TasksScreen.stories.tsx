import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { TasksScreen } from './TasksScreen'

const mockTasks = [
  { id: 't1', title: 'Process daily orders', description: 'Checking 12 new orders and updating stock', agent: 'Sales Agent', status: 'running' as const, startTime: '14:30', duration: '2m 34s', progress: 65 },
  { id: 't2', title: 'Stock reconciliation', description: 'Comparing system vs physical for 48 SKUs', agent: 'Stock Agent', status: 'running' as const, startTime: '14:28', duration: '4m 12s', progress: 40 },
  { id: 't3', title: 'Send financial report', description: 'Generating monthly closing PDF', agent: 'Finance Agent', status: 'running' as const, startTime: '14:25', duration: '7m 01s', progress: 82 },
  { id: 't4', title: 'Respond support tickets', description: 'Processing 5 open tickets', agent: 'Support Agent', status: 'running' as const, startTime: '14:15', duration: '17m 22s', progress: 30 },
  { id: 't5', title: 'Update catalog prices', description: 'Waiting for manager approval', agent: 'Sales Agent', status: 'pending' as const, startTime: '—' },
  { id: 't6', title: 'Import supplier invoices', description: 'XML available, waiting in queue', agent: 'Stock Agent', status: 'pending' as const, startTime: '—' },
  { id: 't7', title: 'Generate daily invoices', agent: 'Finance Agent', status: 'completed' as const, startTime: '13:00', duration: '1m 45s' },
  { id: 't8', title: 'Send proposal to Acme', agent: 'Sales Agent', status: 'completed' as const, startTime: '12:30', duration: '0m 52s' },
  { id: 't11', title: 'Sync with external ERP', description: 'Error: API connection timeout', agent: 'System', status: 'failed' as const, startTime: '10:30', duration: '0m 12s' },
]

const mockFilters = [
  { id: 'all', label: 'All', count: 34 },
  { id: 'running', label: 'Running', count: 4 },
  { id: 'completed', label: 'Completed', count: 21 },
  { id: 'failed', label: 'Failed', count: 3 },
  { id: 'pending', label: 'Pending', count: 6 },
  { id: 'agent-header', label: 'By agent', isHeader: true },
  { id: 'agent-sales', label: 'Sales Agent', count: 12, indent: true },
  { id: 'agent-stock', label: 'Stock Agent', count: 8, indent: true },
]

const meta: Meta<typeof TasksScreen> = {
  title: 'Screens/TasksScreen',
  component: TasksScreen,
  tags: ['task'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    activeFilter: { control: 'select', options: ['all', 'running', 'completed', 'failed', 'pending'] },
    onFilterChange: { action: 'filter-changed' },
  },
  args: { onFilterChange: fn() },
  decorators: [(Story) => <div style={{ height: '100vh' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof TasksScreen>

export const Default: Story = {
  args: { tasks: mockTasks, filters: mockFilters, activeFilter: 'all', runningCount: 4 },
}

/** Click sidebar items to change filter. The "Running now" pills show live count. */
export const FilteredByRunning: Story = {
  args: { tasks: mockTasks, filters: mockFilters, activeFilter: 'running', runningCount: 4 },
}

/** Shows failed tasks. Select the "Failed" filter in the sidebar to see only failed entries. */
export const FilteredByFailed: Story = {
  args: {
    tasks: [
      ...mockTasks,
      { id: 't12', title: 'Send invoice email', description: 'Error: SMTP connection refused', agent: 'Finance Agent', status: 'failed' as const, startTime: '09:15', duration: '0m 05s' },
      { id: 't13', title: 'Import XML invoices', description: 'Error: invalid XML schema', agent: 'Stock Agent', status: 'failed' as const, startTime: '08:50', duration: '0m 08s' },
    ],
    filters: mockFilters,
    activeFilter: 'failed',
    runningCount: 4,
  },
}

export const AgentFilter: Story = {
  args: {
    tasks: [
      ...mockTasks,
      { id: 't14', title: 'Qualify new leads', description: 'Processing 8 new CRM leads', agent: 'Sales Agent', status: 'running' as const, startTime: '14:40', duration: '1m 10s', progress: 50 },
    ],
    filters: [
      ...mockFilters,
      { id: 'agent-finance', label: 'Finance Agent', count: 3, indent: true },
    ],
    activeFilter: 'agent-sales',
    runningCount: 5,
  },
}

export const Empty: Story = {
  args: { tasks: [], filters: mockFilters, activeFilter: 'all', runningCount: 0 },
}

export const AllFailed: Story = {
  args: {
    tasks: [
      { id: 'f1', title: 'Sync with external ERP', description: 'Error: API connection timeout', agent: 'System', status: 'failed' as const, startTime: '10:30', duration: '0m 12s' },
      { id: 'f2', title: 'Send invoice email', description: 'Error: SMTP connection refused', agent: 'Finance Agent', status: 'failed' as const, startTime: '09:15', duration: '0m 05s' },
      { id: 'f3', title: 'Import XML invoices', description: 'Error: invalid XML schema', agent: 'Stock Agent', status: 'failed' as const, startTime: '08:50', duration: '0m 08s' },
    ],
    filters: mockFilters,
    activeFilter: 'failed',
    runningCount: 0,
  },
}
