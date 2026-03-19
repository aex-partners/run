import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { AIChatBar } from './AIChatBar'

const meta: Meta<typeof AIChatBar> = {
  title: 'Molecules/AIChatBar',
  component: AIChatBar,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    disabled: { control: 'boolean' },
    onChange: { action: 'changed' },
    onSend: { action: 'sent' },
  },
  args: { onChange: fn(), onSend: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 500 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof AIChatBar>

/** Default empty state. Type a message and press Enter or click the send button. */
export const Default: Story = {
  args: { placeholder: 'Ask AI about this data...' },
}

/** Pre-filled value activates the send button. Click it or press Enter to trigger onSend. */
export const WithValue: Story = {
  args: { placeholder: 'Ask AI...', value: 'Show overdue orders' },
}

/** Both input and send button are individually disabled for proper accessibility. */
export const Disabled: Story = {
  args: { placeholder: 'AI unavailable', disabled: true },
}

/** Send button is visually inactive when value is empty string — no message to send. */
export const EmptyDisabledSendButton: Story = {
  args: { placeholder: 'Ask AI...', value: '' },
}
