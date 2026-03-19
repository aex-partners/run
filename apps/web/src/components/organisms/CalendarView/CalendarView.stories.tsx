import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { CalendarView } from './CalendarView'

const meta: Meta<typeof CalendarView> = {
  title: 'Organisms/CalendarView',
  component: CalendarView,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: { onEventClick: fn() },
  decorators: [(Story) => <div style={{ height: 600 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof CalendarView>

export const Default: Story = {
  args: {
    columns: [
      { id: 'id', label: 'ID', type: 'text', width: 80 },
      { id: 'name', label: 'Event', type: 'text', width: 200 },
      { id: 'date', label: 'Date', type: 'date', width: 120 },
      { id: 'owner', label: 'Owner', type: 'person', width: 120 },
    ],
    rows: [
      { id: 'EVT-001', name: 'Sprint Planning', date: '2026-03-02', owner: 'Ana Silva' },
      { id: 'EVT-002', name: 'Design Review', date: '2026-03-05', owner: 'Carlos Mendes' },
      { id: 'EVT-003', name: 'Release v2.0', date: '2026-03-10', owner: 'Pedro Costa' },
      { id: 'EVT-004', name: 'Retrospective', date: '2026-03-13', owner: 'Maria Souza' },
      { id: 'EVT-005', name: 'Client Demo', date: '2026-03-18', owner: 'Ana Silva' },
      { id: 'EVT-006', name: 'Team Building', date: '2026-03-22', owner: 'Lucas Oliveira' },
      { id: 'EVT-007', name: 'Sprint Review', date: '2026-03-27', owner: 'Carlos Mendes' },
    ],
    dateColumnId: 'date',
  },
}

export const WithTimeline: Story = {
  name: 'With Timeline Dates',
  args: {
    columns: [
      { id: 'id', label: 'ID', type: 'text', width: 80 },
      { id: 'task', label: 'Task', type: 'text', width: 200 },
      { id: 'timeline', label: 'Timeline', type: 'timeline', width: 200 },
    ],
    rows: [
      { id: 'P-001', task: 'Phase 1 Planning', timeline: '2026-03-01|2026-03-07' },
      { id: 'P-002', task: 'Development Sprint', timeline: '2026-03-08|2026-03-28' },
      { id: 'P-003', task: 'QA Testing', timeline: '2026-03-29|2026-04-05' },
    ],
    dateColumnId: 'timeline',
  },
}
