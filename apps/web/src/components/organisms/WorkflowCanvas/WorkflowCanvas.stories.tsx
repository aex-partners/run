import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { WorkflowCanvas } from './WorkflowCanvas'

const sampleNodes = [
  { id: 'n1', type: 'trigger', position: { x: 250, y: 40 }, data: { label: 'New sales order', description: 'When an order is created or updated' } },
  { id: 'n2', type: 'action', position: { x: 250, y: 180 }, data: { label: 'Update stock', description: 'Deduct quantity from order items' } },
  { id: 'n3', type: 'condition', position: { x: 250, y: 320 }, data: { label: 'Stock below minimum?', description: 'Check if any product is critical' } },
  { id: 'n4', type: 'notification', position: { x: 80, y: 460 }, data: { label: 'Alert manager', description: 'Message in #operations channel' } },
  { id: 'n5', type: 'notification', position: { x: 420, y: 460 }, data: { label: 'Confirm order', description: 'Send confirmation email to customer' } },
]

const sampleEdges = [
  { id: 'e1-2', source: 'n1', target: 'n2', animated: true, style: { stroke: 'var(--accent)', strokeWidth: 2 } },
  { id: 'e2-3', source: 'n2', target: 'n3', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } },
  { id: 'e3-4', source: 'n3', sourceHandle: 'yes', target: 'n4', style: { stroke: 'var(--success)', strokeWidth: 2 } },
  { id: 'e3-5', source: 'n3', sourceHandle: 'no', target: 'n5', style: { stroke: '#6366f1', strokeWidth: 2 } },
]

const simpleNodes = [
  { id: 'n1', type: 'trigger', position: { x: 250, y: 40 }, data: { label: 'Stock < minimum', description: 'Monitored every hour' } },
  { id: 'n2', type: 'notification', position: { x: 250, y: 180 }, data: { label: 'Notify purchasing manager', description: '#purchasing channel + email' } },
]

const simpleEdges = [
  { id: 'e1-2', source: 'n1', target: 'n2', animated: true, style: { stroke: 'var(--accent)', strokeWidth: 2 } },
]

const customLabelNodes = [
  { id: 'n1', type: 'trigger', position: { x: 250, y: 40 }, data: { label: 'Payment received', description: 'Webhook from payment gateway' } },
  { id: 'n2', type: 'condition', position: { x: 250, y: 180 }, data: { label: 'Amount above threshold?', description: 'Check if payment > $1000', yesLabel: 'Above limit', noLabel: 'Within limit' } },
  { id: 'n3', type: 'notification', position: { x: 80, y: 320 }, data: { label: 'Flag for review', description: 'Notify compliance team' } },
  { id: 'n4', type: 'notification', position: { x: 420, y: 320 }, data: { label: 'Auto-approve', description: 'Process immediately' } },
]

const customLabelEdges = [
  { id: 'e1-2', source: 'n1', target: 'n2', animated: true, style: { stroke: 'var(--accent)', strokeWidth: 2 } },
  { id: 'e2-3', source: 'n2', sourceHandle: 'yes', target: 'n3', style: { stroke: 'var(--success)', strokeWidth: 2 } },
  { id: 'e2-4', source: 'n2', sourceHandle: 'no', target: 'n4', style: { stroke: '#6366f1', strokeWidth: 2 } },
]

const meta: Meta<typeof WorkflowCanvas> = {
  title: 'Organisms/WorkflowCanvas',
  component: WorkflowCanvas,
  tags: ['workflow'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    readOnly: { control: 'boolean' },
    onConnect: { action: 'connected' },
    onNodesChange: { action: 'nodes-changed' },
    onEdgesChange: { action: 'edges-changed' },
    onNodeDelete: { action: 'node-deleted' },
    onNodeEdit: { action: 'node-edited' },
  },
  args: { onConnect: fn(), onNodesChange: fn(), onEdgesChange: fn(), onNodeDelete: fn(), onNodeEdit: fn() },
  decorators: [(Story) => <div style={{ height: 600 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof WorkflowCanvas>

export const Default: Story = {
  args: { nodes: sampleNodes, edges: sampleEdges },
}

export const Readonly: Story = {
  args: { nodes: sampleNodes, edges: sampleEdges, readOnly: true },
}

export const Simple: Story = {
  args: { nodes: simpleNodes, edges: simpleEdges },
}

export const Empty: Story = {
  args: { nodes: [], edges: [] },
}

/** Click the × button on any node to delete it */
export const WithNodeDelete: Story = {
  args: {
    nodes: sampleNodes,
    edges: sampleEdges,
    onNodeDelete: fn(),
  },
}

/** Double-click any node label to edit it inline. Press Enter or click away to confirm. Esc cancels. */
export const WithNodeEdit: Story = {
  args: {
    nodes: sampleNodes,
    edges: sampleEdges,
    onNodeEdit: fn(),
  },
}

export const WithCustomConditionLabels: Story = {
  args: {
    nodes: customLabelNodes,
    edges: customLabelEdges,
    onNodeDelete: fn(),
    onNodeEdit: fn(),
  },
}

/** Hover any node to reveal the × delete button, and double-click any label to edit it inline. Both callbacks are wired. */
export const AllInteractions: Story = {
  args: {
    nodes: sampleNodes,
    edges: sampleEdges,
    onNodeDelete: fn(),
    onNodeEdit: fn(),
  },
}

/** Right-click anywhere on the canvas background to open the "Add node" context menu. */
export const AddNodeFromContextMenu: Story = {
  args: { nodes: sampleNodes, edges: sampleEdges },
}
