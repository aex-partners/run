import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { EntityRow } from './EntityRow'

const meta: Meta<typeof EntityRow> = {
  title: 'Molecules/EntityRow',
  component: EntityRow,
  tags: ['data'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    selected: { control: 'boolean' },
    onSelect: { action: 'selected' },
    onDelete: { action: 'deleted' },
  },
  args: { onSelect: fn(), onDelete: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 700, background: 'var(--surface)' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof EntityRow>

export const Default: Story = {
  args: {
    cells: [
      { value: 'CLI-001', type: 'text' },
      { value: 'Acme Distributors', type: 'text' },
      { value: 'New York', type: 'text' },
      { value: 42, type: 'number' },
    ],
  },
}

export const Selected: Story = {
  args: {
    selected: true,
    cells: [
      { value: 'CLI-002', type: 'text' },
      { value: 'Beta Commerce', type: 'text' },
      { value: 'Los Angeles', type: 'text' },
      { value: 18, type: 'number' },
    ],
  },
}

export const WithBadge: Story = {
  args: {
    cells: [
      { value: 'CLI-003', type: 'text' },
      { value: 'Gamma Tech', type: 'text' },
      { value: 'Active', type: 'badge', badgeVariant: 'success' },
      { value: 5, type: 'number' },
    ],
  },
}

/** Hover the row to reveal the trash icon at the far right. Clicking it calls onDelete. */
export const WithDelete: Story = {
  name: 'With Delete',
  args: {
    cells: [
      { value: 'CLI-004', type: 'text' },
      { value: 'Delta Industries', type: 'text' },
      { value: 'Inactive', type: 'badge', badgeVariant: 'danger' },
      { value: 31, type: 'number' },
    ],
    onDelete: fn(),
  },
}

/** Row without onDelete prop: no delete button appears on hover. */
export const NoDelete: Story = {
  name: 'No Delete Handler',
  args: {
    cells: [
      { value: 'CLI-005', type: 'text' },
      { value: 'Epsilon Logistics', type: 'text' },
      { value: 'Pending', type: 'badge', badgeVariant: 'warning' },
      { value: 0, type: 'number' },
    ],
    onDelete: undefined,
  },
}

/** Row with badge cells covering all available variants: success, warning, danger, info, neutral, orange. */
export const WithAllBadgeVariants: Story = {
  args: {
    cells: [
      { value: 'Active', type: 'badge', badgeVariant: 'success' },
      { value: 'Pending', type: 'badge', badgeVariant: 'warning' },
      { value: 'Failed', type: 'badge', badgeVariant: 'danger' },
      { value: 'Info', type: 'badge', badgeVariant: 'info' },
      { value: 'Neutral', type: 'badge', badgeVariant: 'neutral' },
      { value: 'Review', type: 'badge', badgeVariant: 'orange' },
    ],
  },
}

/** Row with a date-type cell rendered in plain text format. */
export const WithDateCell: Story = {
  args: {
    cells: [
      { value: 'ORD-201', type: 'text' },
      { value: 'Zeta Supply Co.', type: 'text' },
      { value: '2026-03-11', type: 'date' },
      { value: 7, type: 'number' },
    ],
  },
}
