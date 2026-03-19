import type { Meta, StoryObj } from '@storybook/react'
import { DateSeparator } from './DateSeparator'

const meta: Meta<typeof DateSeparator> = {
  title: 'Molecules/DateSeparator',
  component: DateSeparator,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  decorators: [(Story) => <div style={{ maxWidth: 500 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof DateSeparator>

export const Today: Story = {
  args: { label: 'Today' },
}

export const Yesterday: Story = {
  args: { label: 'Yesterday' },
}

export const SpecificDate: Story = {
  args: { label: 'March 10' },
}
