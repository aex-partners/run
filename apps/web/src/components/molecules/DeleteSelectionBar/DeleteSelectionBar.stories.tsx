import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { DeleteSelectionBar } from './DeleteSelectionBar'

const meta: Meta<typeof DeleteSelectionBar> = {
  title: 'Molecules/DeleteSelectionBar',
  component: DeleteSelectionBar,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: { onCancel: fn(), onDelete: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 500 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof DeleteSelectionBar>

export const NoSelection: Story = {
  args: { selectedCount: 0 },
}

export const Single: Story = {
  args: { selectedCount: 1 },
}

export const Multiple: Story = {
  args: { selectedCount: 3 },
}
