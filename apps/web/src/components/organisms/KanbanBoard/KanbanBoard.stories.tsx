import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { KanbanBoard } from './KanbanBoard'

const meta: Meta<typeof KanbanBoard> = {
  title: 'Organisms/KanbanBoard',
  component: KanbanBoard,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onCardClick: { action: 'card-click' },
  },
  args: { onCardClick: fn() },
  decorators: [(Story) => <div style={{ height: 600 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof KanbanBoard>

export const ByStatus: Story = {
  name: 'By Status',
  args: {
    columns: [
      { id: 'id', label: 'ID', type: 'text', width: 80 },
      { id: 'name', label: 'Task', type: 'text', width: 180 },
      { id: 'owner', label: 'Owner', type: 'person', width: 120 },
      {
        id: 'status', label: 'Status', type: 'status', width: 130,
        statusColors: {
          'Done': '#00c875',
          'Working on it': '#fdab3d',
          'Stuck': '#e2445c',
          'Not started': '#c4c4c4',
        },
      },
      { id: 'priority', label: 'Priority', type: 'priority', width: 120 },
    ],
    rows: [
      { id: 'TSK-001', name: 'Website Redesign', owner: 'Ana Silva', status: 'Working on it', priority: 'High' },
      { id: 'TSK-002', name: 'Mobile App v2', owner: 'Carlos Mendes', status: 'Done', priority: 'Critical' },
      { id: 'TSK-003', name: 'API Integration', owner: 'Pedro Costa', status: 'Stuck', priority: 'High' },
      { id: 'TSK-004', name: 'Database Migration', owner: 'Lucas Oliveira', status: 'Working on it', priority: 'Medium' },
      { id: 'TSK-005', name: 'Security Audit', owner: 'Fernanda Lima', status: 'Not started', priority: 'Low' },
      { id: 'TSK-006', name: 'Design System', owner: 'Ana Silva', status: 'Not started', priority: 'Medium' },
    ],
    groupByColumn: 'status',
  },
}
