import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { ForwardSelectionBar } from './ForwardSelectionBar'

const meta: Meta<typeof ForwardSelectionBar> = {
  title: 'Molecules/ForwardSelectionBar',
  component: ForwardSelectionBar,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: { onCancel: fn(), onForward: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 500 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof ForwardSelectionBar>

export const NoSelection: Story = {
  args: { selectedCount: 0 },
}

export const Single: Story = {
  args: { selectedCount: 1 },
}

export const Multiple: Story = {
  args: { selectedCount: 5 },
}
