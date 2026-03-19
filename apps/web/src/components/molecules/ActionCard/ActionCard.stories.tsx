import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { ActionCard } from './ActionCard'

const meta: Meta<typeof ActionCard> = {
  title: 'Molecules/ActionCard',
  component: ActionCard,
  tags: ['deprecated'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    loading: { control: 'boolean' },
    active: { control: 'boolean' },
    onConfirm: { action: 'confirmed' },
    onDeny: { action: 'denied' },
  },
  args: { onConfirm: fn(), onDeny: fn() },
}
export default meta
type Story = StoryObj<typeof ActionCard>

/** Default active card. Press Enter to confirm or Esc to cancel. */
export const Default: Story = {
  args: {
    question: 'Request approval to move dispatch of order #1047 to 14:45?',
    active: true,
  },
}

export const WithDescription: Story = {
  args: {
    question: 'Request approval to move up dispatch?',
    description: 'This action will notify stock manager Carlos Mendes.',
    confirmLabel: 'Yes, request',
    denyLabel: 'Not now',
  },
}

export const Loading: Story = {
  args: {
    question: 'Processing request...',
    loading: true,
  },
}

/** Card with active=false: keyboard shortcuts are inactive and the hint is hidden. */
export const Inactive: Story = {
  args: {
    question: 'Keyboard shortcuts are disabled for this card.',
    active: false,
  },
}

/** No handlers provided: keyboard hint must not appear regardless of active state. */
export const NoHandlers: Story = {
  args: {
    question: 'This card has no confirm or deny handlers attached.',
    active: true,
    onConfirm: undefined,
    onDeny: undefined,
  },
}

/** Danger-style confirm for destructive actions. */
export const Destructive: Story = {
  args: {
    question: 'Are you sure you want to delete this shipment record?',
    description: 'This cannot be undone. All related entries will be removed.',
    confirmLabel: 'Delete permanently',
    denyLabel: 'Keep it',
  },
}
