import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { SelectField } from './SelectField'

const COUNTRIES = [
  { value: 'BR', label: 'Brazil' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
]

const meta: Meta<typeof SelectField> = {
  title: 'Atoms/SelectField',
  component: SelectField,
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
  decorators: [(Story) => <div style={{ width: 280 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof SelectField>

/** Default select with placeholder. */
export const Default: Story = {
  args: { label: 'Country', options: COUNTRIES, placeholder: 'Select a country' },
}

/** Select with a pre-selected value. */
export const WithValue: Story = {
  args: { label: 'Country', options: COUNTRIES, value: 'BR', placeholder: 'Select a country' },
}

/** Select showing an error state. */
export const WithError: Story = {
  args: { label: 'Country', options: COUNTRIES, placeholder: 'Select a country', error: 'Please select a country.' },
}

/** Disabled select — non-interactive. */
export const Disabled: Story = {
  args: { label: 'Country', options: COUNTRIES, value: 'US', disabled: true },
}
