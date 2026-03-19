import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { CredentialField } from './CredentialField'

const meta: Meta<typeof CredentialField> = {
  title: 'Molecules/CredentialField',
  component: CredentialField,
  tags: ['form-control'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    disabled: { control: 'boolean' },
    onChange: { action: 'changed' },
  },
  args: { onChange: fn() },
  decorators: [(Story) => <div style={{ width: 360 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof CredentialField>

/** Default masked state. Click the eye icon to reveal. */
export const Masked: Story = {
  args: {
    value: 'sk-abc123def456ghi789',
    label: 'API Key',
    placeholder: 'Enter API key...',
  },
}

/** Revealed state showing the actual value. */
export const Revealed: Story = {
  args: {
    value: 'sk-abc123def456ghi789',
    label: 'API Key',
  },
}
