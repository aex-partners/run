import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { ReactionBadge } from './ReactionBadge'

const meta: Meta<typeof ReactionBadge> = {
  title: 'Atoms/ReactionBadge',
  component: ReactionBadge,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    reacted: { control: 'boolean' },
    count: { control: 'number' },
    emoji: { control: 'text' },
  },
  args: { onClick: fn() },
}
export default meta
type Story = StoryObj<typeof ReactionBadge>

export const Default: Story = {
  args: { emoji: '\u{1F44D}', count: 3, reacted: false },
}

export const Reacted: Story = {
  args: { emoji: '\u2764\uFE0F', count: 5, reacted: true },
}

export const HighCount: Story = {
  args: { emoji: '\u{1F602}', count: 42, reacted: false },
}

export const Multiple: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 6 }}>
      <ReactionBadge emoji={'\u{1F44D}'} count={3} reacted={true} onClick={fn()} />
      <ReactionBadge emoji={'\u2764\uFE0F'} count={1} reacted={false} onClick={fn()} />
      <ReactionBadge emoji={'\u{1F602}'} count={7} reacted={false} onClick={fn()} />
      <ReactionBadge emoji={'\u{1F64F}'} count={2} reacted={true} onClick={fn()} />
    </div>
  ),
}
