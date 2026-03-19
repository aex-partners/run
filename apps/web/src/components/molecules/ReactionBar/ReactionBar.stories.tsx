import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { ReactionBar } from './ReactionBar'

const meta: Meta<typeof ReactionBar> = {
  title: 'Molecules/ReactionBar',
  component: ReactionBar,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: { onReact: fn() },
  decorators: [(Story) => <div style={{ paddingTop: 200 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof ReactionBar>

export const Default: Story = {}

export const WithMoreOpen: Story = {
  render: () => {
    // Note: the "more" panel opens on click of the Plus button
    return (
      <div style={{ paddingTop: 200 }}>
        <ReactionBar onReact={fn()} />
      </div>
    )
  },
}
