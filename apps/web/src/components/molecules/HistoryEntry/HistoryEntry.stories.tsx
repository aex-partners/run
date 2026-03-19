import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { HistoryEntry } from './HistoryEntry'

const meta: Meta<typeof HistoryEntry> = {
  title: 'Molecules/HistoryEntry',
  component: HistoryEntry,
  tags: ['display'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    status: { control: 'select', options: ['success', 'failed'] },
    onExpand: { action: 'expanded' },
    onRetry: { action: 'retried' },
  },
  decorators: [(Story) => <div style={{ width: 320, background: 'var(--surface)' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof HistoryEntry>

export const Success: Story = {
  args: { timestamp: '14:28', status: 'success', duration: '1.1s', message: 'Order #1051 — Stock updated' },
}

export const Failed: Story = {
  args: { timestamp: '14:12', status: 'failed', duration: '2.3s', message: 'Error: product CLI-009 not found' },
}

/** Click the chevron button to expand/collapse the details panel. */
export const WithExpand: Story = {
  args: {
    timestamp: '14:31',
    status: 'success',
    duration: '0.8s',
    message: 'Order #1052 — Stock updated',
    details: 'Updated stock for 3 products: CLI-001 (-5), CLI-002 (-2), CLI-003 (-1). All levels remain above minimum threshold.',
    onExpand: fn(),
  },
}

/** Click the chevron to expand details, and the Retry button to re-trigger the failed workflow. */
export const FailedWithRetry: Story = {
  args: {
    timestamp: '14:12',
    status: 'failed',
    duration: '2.3s',
    message: 'Error: product CLI-009 not found',
    details: 'The workflow attempted to deduct stock for product CLI-009 but it does not exist in the catalog.',
    onExpand: fn(),
    onRetry: fn(),
  },
}

/**
 * Success entry with details pre-shown. The component starts collapsed — click the
 * chevron to reveal the details panel. Use this story to verify expand behaviour.
 */
export const SuccessExpanded: Story = {
  args: {
    timestamp: '09:15',
    status: 'success',
    duration: '0.5s',
    message: 'Order #1060 — Invoice generated',
    details: 'Invoice INV-2026-0311 created and emailed to billing@acme.com.',
    onExpand: fn(),
  },
}

/** Failed entry without a retry handler — only the expand button is shown. */
export const FailedNoRetry: Story = {
  args: {
    timestamp: '10:44',
    status: 'failed',
    duration: '3.1s',
    message: 'Error: payment gateway timeout',
    details: 'Connection to Stripe timed out after 30s. No charge was made.',
    onExpand: fn(),
    onRetry: undefined,
  },
}
