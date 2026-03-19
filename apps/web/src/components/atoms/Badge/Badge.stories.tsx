import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from './Badge'

const meta: Meta<typeof Badge> = {
  title: 'Atoms/Badge',
  component: Badge,
  tags: ['display'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    variant: { control: 'select', options: ['success', 'warning', 'danger', 'info', 'neutral', 'orange'] },
    size: { control: 'select', options: ['sm', 'md'] },
    dot: { control: 'boolean' },
  },
}
export default meta
type Story = StoryObj<typeof Badge>

/** Default neutral badge at medium size. */
export const Default: Story = { args: { children: 'Neutral', variant: 'neutral' } }

/** Success variant — green palette indicating an active or completed state. */
export const Success: Story = { args: { children: 'Active', variant: 'success' } }

/** Warning variant — amber palette for items needing attention. */
export const Warning: Story = { args: { children: 'Pending', variant: 'warning' } }

/** Danger variant — red palette for failed or critical states. */
export const Danger: Story = { args: { children: 'Failed', variant: 'danger' } }

/** Info variant — blue palette for informational labels. */
export const Info: Story = { args: { children: 'Info', variant: 'info' } }

/** Orange/accent variant — used for running or in-progress states. */
export const Orange: Story = { args: { children: 'Running', variant: 'orange' } }

/** Medium badge with a leading dot indicator. */
export const WithDot: Story = { args: { children: 'Online', variant: 'success', dot: true } }

/** Small neutral badge — compact 10 px text, tighter padding. */
export const Small: Story = { args: { children: 'sm', variant: 'neutral', size: 'sm' } }

/** Small badge with a dot indicator — verifies dot renders correctly at compact size. */
export const SmallWithDot: Story = { args: { children: 'Active', variant: 'success', size: 'sm', dot: true } }

/** Small danger badge — confirms small size works across multiple variants. */
export const SmallDanger: Story = { args: { children: 'Failed', variant: 'danger', size: 'sm' } }
