import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Plus, Trash2, ArrowRight } from 'lucide-react'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  tags: ['form-control'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    onClick: { action: 'clicked' },
  },
  args: { onClick: fn() },
}
export default meta
type Story = StoryObj<typeof Button>

/** Default primary button at medium size. */
export const Default: Story = { args: { children: 'Button', variant: 'primary' } }

/** Secondary variant with a bordered, transparent background. */
export const Secondary: Story = { args: { children: 'Button', variant: 'secondary' } }

/** Ghost variant — muted text, no border, for low-emphasis actions. */
export const Ghost: Story = { args: { children: 'Button', variant: 'ghost' } }

/** Danger variant — red background for destructive actions. */
export const Danger: Story = { args: { children: 'Delete', variant: 'danger' } }

/** Disabled state — pointer-events off, reduced opacity. */
export const Disabled: Story = { args: { children: 'Button', disabled: true } }

/** Loading state — spinner replaces left icon and aria-busy is set. */
export const Loading: Story = { args: { children: 'Saving...', loading: true } }

/** Disabled while loading — both flags active simultaneously. */
export const DisabledLoading: Story = { args: { children: 'Please wait...', disabled: true, loading: true } }

/** Small size — 28 px height, compact padding. */
export const Small: Story = { args: { children: 'Button', size: 'sm' } }

/** Large size — 40 px height, roomier padding. */
export const Large: Story = { args: { children: 'Button', size: 'lg' } }

/** Left icon combined with label. */
export const WithLeftIcon: Story = { args: { children: 'New', variant: 'primary', leftIcon: <Plus size={13} /> } }

/** Right icon combined with label. */
export const WithRightIcon: Story = { args: { children: 'Delete', variant: 'danger', rightIcon: <Trash2 size={13} /> } }

/** Both a left icon and a right icon rendered alongside the label. */
export const BothIcons: Story = {
  args: { children: 'Continue', variant: 'primary', leftIcon: <Plus size={13} />, rightIcon: <ArrowRight size={13} /> },
}

/** Submit button — type="submit" for use inside HTML forms. */
export const Submit: Story = { args: { children: 'Submit', variant: 'primary', type: 'submit' } }
