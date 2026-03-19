import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { DeleteConfirmModal } from './DeleteConfirmModal'

const meta: Meta<typeof DeleteConfirmModal> = {
  title: 'Organisms/DeleteConfirmModal',
  component: DeleteConfirmModal,
  tags: ['chat'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    onDeleteForEveryone: fn(),
    onDeleteForMe: fn(),
  },
}
export default meta
type Story = StoryObj<typeof DeleteConfirmModal>

export const Default: Story = {}
