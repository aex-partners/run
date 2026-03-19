import type { Meta, StoryObj } from '@storybook/react'
import { ReplyQuote } from './ReplyQuote'

const meta: Meta<typeof ReplyQuote> = {
  title: 'Molecules/ReplyQuote',
  component: ReplyQuote,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  decorators: [(Story) => <div style={{ maxWidth: 400 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof ReplyQuote>

export const Default: Story = {
  args: { author: 'RUN AI', content: 'Order #1047 has been confirmed and dispatched.' },
}

export const LongContent: Story = {
  args: {
    author: 'Carlos Mendes',
    content: 'I checked with the logistics team and the updated route optimization report shows a 12% improvement in fuel costs compared to last month.',
  },
}

export const ShortContent: Story = {
  args: { author: 'You', content: 'OK' },
}
