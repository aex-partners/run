import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { WorkflowsScreen } from './WorkflowsScreen'

const mockWorkflows = [
  { id: 'wf1', name: 'Order Received → Stock', trigger: 'New sales order', status: 'active' as const },
  { id: 'wf2', name: 'Low Stock Alert', trigger: 'Stock < minimum', status: 'active' as const },
  { id: 'wf3', name: 'Daily Financial Report', trigger: 'Scheduled: 18:00', status: 'active' as const },
  { id: 'wf4', name: 'Proposal Follow-up', trigger: 'Proposal sent + 3 days', status: 'paused' as const },
]

const wf1Graph = {
  nodes: [
    { id: 'n1', type: 'trigger', position: { x: 250, y: 40 }, data: { label: 'New sales order', description: 'When an order is created or updated' } },
    { id: 'n2', type: 'action', position: { x: 250, y: 180 }, data: { label: 'Update stock', description: 'Deduct quantity from order items' } },
    { id: 'n3', type: 'condition', position: { x: 250, y: 320 }, data: { label: 'Stock below minimum?', description: 'Check if any product is critical' } },
    { id: 'n4', type: 'notification', position: { x: 80, y: 460 }, data: { label: 'Alert manager', description: 'Send to #operations channel' } },
    { id: 'n5', type: 'notification', position: { x: 420, y: 460 }, data: { label: 'Confirm order', description: 'Send confirmation email to customer' } },
  ],
  edges: [
    { id: 'e1-2', source: 'n1', target: 'n2', animated: true, style: { stroke: '#EA580C', strokeWidth: 2 } },
    { id: 'e2-3', source: 'n2', target: 'n3', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } },
    { id: 'e3-4', source: 'n3', sourceHandle: 'yes', target: 'n4', style: { stroke: '#16a34a', strokeWidth: 2 } },
    { id: 'e3-5', source: 'n3', sourceHandle: 'no', target: 'n5', style: { stroke: '#6366f1', strokeWidth: 2 } },
  ],
}

const wf2Graph = {
  nodes: [
    { id: 'n1', type: 'trigger', position: { x: 250, y: 40 }, data: { label: 'Stock < minimum', description: 'Monitored every hour' } },
    { id: 'n2', type: 'notification', position: { x: 250, y: 180 }, data: { label: 'Notify purchasing manager', description: '#purchasing channel + email' } },
  ],
  edges: [
    { id: 'e1-2', source: 'n1', target: 'n2', animated: true, style: { stroke: '#EA580C', strokeWidth: 2 } },
  ],
}

const mockHistory = [
  { timestamp: '14:31', status: 'success' as const, duration: '0.8s', message: 'Order #1052 — Stock updated' },
  { timestamp: '14:28', status: 'success' as const, duration: '1.1s', message: 'Order #1051 — Stock updated' },
  { timestamp: '14:12', status: 'failed' as const, duration: '2.3s', message: 'Error: product CLI-009 not found' },
  { timestamp: '14:05', status: 'success' as const, duration: '0.7s', message: 'Order #1049 — Stock updated' },
]

const meta: Meta<typeof WorkflowsScreen> = {
  title: 'Screens/WorkflowsScreen',
  component: WorkflowsScreen,
  tags: ['workflow'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onWorkflowSelect: { action: 'workflow-selected' },
    onNewWorkflow: { action: 'new-workflow' },
    onToggleStatus: { action: 'toggle-status' },
    onAISend: { action: 'ai-sent' },
    onDeleteWorkflow: { action: 'workflow-deleted' },
    onDuplicateWorkflow: { action: 'workflow-duplicated' },
  },
  args: {
    onWorkflowSelect: fn(),
    onNewWorkflow: fn(),
    onToggleStatus: fn(),
    onAISend: fn(),
    onDeleteWorkflow: fn(),
    onDuplicateWorkflow: fn(),
  },
  decorators: [(Story) => <div style={{ height: '100vh' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof WorkflowsScreen>

export const Default: Story = {
  args: {
    workflows: mockWorkflows,
    workflowGraphs: { wf1: wf1Graph, wf2: wf2Graph },
    activeWorkflowId: 'wf1',
    historyEntries: mockHistory,
  },
}

export const SimpleWorkflow: Story = {
  args: {
    workflows: mockWorkflows,
    workflowGraphs: { wf1: wf1Graph, wf2: wf2Graph },
    activeWorkflowId: 'wf2',
    historyEntries: mockHistory,
  },
}

/** Click the ··· button in the header to duplicate or delete the active workflow */
export const WorkflowDuplicateDelete: Story = {
  name: 'Duplicate / Delete workflow',
  args: {
    workflows: mockWorkflows,
    workflowGraphs: { wf1: wf1Graph, wf2: wf2Graph },
    activeWorkflowId: 'wf2',
    historyEntries: mockHistory,
  },
}

export const PausedWorkflow: Story = {
  args: {
    workflows: mockWorkflows,
    workflowGraphs: { wf1: wf1Graph, wf2: wf2Graph },
    activeWorkflowId: 'wf4',
    historyEntries: mockHistory,
  },
}

export const EmptyHistory: Story = {
  args: {
    workflows: mockWorkflows,
    workflowGraphs: { wf1: wf1Graph, wf2: wf2Graph },
    activeWorkflowId: 'wf1',
    historyEntries: [],
  },
}
