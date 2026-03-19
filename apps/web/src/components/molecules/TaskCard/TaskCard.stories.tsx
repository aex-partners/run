import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { TaskCard } from './TaskCard'

const meta: Meta<typeof TaskCard> = {
  title: 'Molecules/TaskCard',
  component: TaskCard,
  tags: ['task'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    status: { control: 'select', options: ['running', 'pending', 'completed', 'failed'] },
    taskType: { control: 'select', options: ['inference', 'structured'] },
    progress: { control: { type: 'range', min: 0, max: 100 } },
    onClick: { action: 'clicked' },
  },
  args: {
    onClick: fn(),
    onCancel: fn(),
    onRetry: fn(),
    onViewLogs: fn(),
  },
  decorators: [(Story) => <div style={{ maxWidth: 600 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof TaskCard>

/** A task waiting in queue before execution begins. */
export const Pending: Story = {
  args: {
    id: 't5',
    title: 'Update catalog prices',
    description: 'Waiting for manager approval',
    agent: 'Sales Agent',
    status: 'pending',
    startTime: '—',
  },
}

/** Running task with a progress bar. */
export const Running: Story = {
  args: {
    id: 't1',
    title: 'Process daily orders',
    description: 'Checking 12 new orders and updating stock',
    agent: 'Sales Agent',
    status: 'running',
    startTime: '14:30',
    duration: '2m 34s',
    progress: 65,
  },
}

/**
 * Running task with onCancel wired — hover the card to reveal the Cancel button.
 */
export const RunningWithCancel: Story = {
  args: {
    id: 't2',
    title: 'Send bulk invoice emails',
    description: 'Sending to 84 customers',
    agent: 'Finance Agent',
    status: 'running',
    startTime: '15:00',
    duration: '0m 45s',
    progress: 30,
    onCancel: fn(),
  },
}

export const Completed: Story = {
  args: {
    id: 't7',
    title: 'Generate daily invoices',
    agent: 'Finance Agent',
    status: 'completed',
    startTime: '13:00',
    duration: '1m 45s',
  },
}

/**
 * Completed task with the View Logs button wired — it appears because status is
 * completed and onViewLogs is provided.
 */
export const CompletedWithLogs: Story = {
  args: {
    id: 't8',
    title: 'Sync inventory snapshot',
    description: 'Exported 1,200 SKUs to warehouse system',
    agent: 'Stock Agent',
    status: 'completed',
    startTime: '12:00',
    duration: '3m 10s',
    onViewLogs: fn(),
  },
}

export const Failed: Story = {
  args: {
    id: 't11',
    title: 'Sync with external ERP',
    description: 'Error: API connection timeout',
    agent: 'System',
    status: 'failed',
    startTime: '10:30',
    duration: '0m 12s',
  },
}

export const FailedWithRetry: Story = {
  name: 'Failed with Retry and Logs',
  args: {
    id: 't12',
    title: 'Import supplier invoices',
    description: 'Error: XML schema validation failed',
    agent: 'Stock Agent',
    status: 'failed',
    startTime: '09:15',
    duration: '0m 8s',
    onRetry: fn(),
    onViewLogs: fn(),
  },
}

/** Inference task type badge. */
export const InferenceTask: Story = {
  args: {
    id: 't20',
    title: 'Analyze sales report',
    description: 'Generating insights from Q1 data',
    agent: 'Sales Agent',
    status: 'running',
    startTime: '16:00',
    duration: '1m 20s',
    progress: 40,
    taskType: 'inference',
  },
}

/** Structured task with tool name shown. */
export const StructuredTask: Story = {
  args: {
    id: 't21',
    title: 'Create invoice',
    description: 'Creating NF-e for order PED-1234',
    agent: 'Finance Agent',
    status: 'completed',
    startTime: '15:30',
    duration: '0m 12s',
    taskType: 'structured',
    toolName: 'criar_nfe',
  },
}
