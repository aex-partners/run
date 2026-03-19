import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Users, ShoppingCart } from 'lucide-react'
import { StatsCard } from './StatsCard'

const meta: Meta<typeof StatsCard> = {
  title: 'Molecules/StatsCard',
  component: StatsCard,
  tags: ['display'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onClick: { action: 'clicked' },
  },
  decorators: [(Story) => <div style={{ width: 220 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof StatsCard>

export const Default: Story = {
  args: { label: 'Orders Today', value: 42 },
}

export const WithIcon: Story = {
  args: { label: 'Active Customers', value: 248, icon: <Users size={16} /> },
}

export const WithTrendUp: Story = {
  args: {
    label: 'Monthly Revenue',
    value: '$184k',
    icon: <ShoppingCart size={16} />,
    trend: { value: 12, direction: 'up' },
    trendLabel: 'vs last month',
  },
}

export const WithTrendDown: Story = {
  args: {
    label: 'Cancellations',
    value: 8,
    trend: { value: 5, direction: 'down' },
    trendLabel: 'vs last month',
  },
}

/**
 * Clickable card with a tooltip — hover to see the border highlight and the
 * native title tooltip. Click to fire the onClick action.
 */
export const Clickable: Story = {
  args: {
    label: 'Orders Today',
    value: 42,
    icon: <Users size={16} />,
    onClick: fn(),
    tooltip: 'Click to view order details',
  },
}
