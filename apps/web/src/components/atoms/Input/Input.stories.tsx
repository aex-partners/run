import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Search, Eye } from 'lucide-react'
import { Input } from './Input'

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
  tags: ['form-control'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    disabled: { control: 'boolean' },
    onChange: { action: 'changed' },
    onClear: { action: 'cleared' },
  },
  args: { onChange: fn() },
  decorators: [(Story) => <div style={{ width: 280 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof Input>

/** Empty input with placeholder text. */
export const Default: Story = { args: { placeholder: 'Type something...' } }

/** Input with a pre-filled value. */
export const WithValue: Story = { args: { placeholder: 'Name', value: 'Ana Lima' } }

/** Left icon for visual context — search magnifier example. */
export const WithLeftIcon: Story = { args: { placeholder: 'Search...', leftIcon: <Search size={14} /> } }

/** Disabled state — 50 % opacity, non-interactive. */
export const Disabled: Story = { args: { placeholder: 'Disabled', disabled: true, value: 'Value' } }

/** Error state — red border and linked error message via aria-describedby. */
export const WithError: Story = { args: { placeholder: 'Email', value: 'invalid', error: 'Invalid email address' } }

/** Error with a current value and an active clear button — combines all three states. */
export const WithErrorAndClear: Story = {
  args: {
    placeholder: 'Email',
    value: 'bad@',
    error: 'Please enter a valid email address',
    onClear: fn(),
  },
}

/** Search input with a value and a clear (×) button. */
export const WithClearButton: Story = {
  args: { placeholder: 'Search...', value: 'Ana Lima', leftIcon: <Search size={14} />, onClear: fn() },
}

/** Password type — browser masks the value. */
export const PasswordType: Story = {
  args: { placeholder: 'Enter password', type: 'password', rightIcon: <Eye size={14} /> },
}

/** Focus ring visible when the input is active — click to see the accent outline. */
export const WithFocus: Story = {
  args: { placeholder: 'Click to focus and see outline', leftIcon: <Search size={14} /> },
}
