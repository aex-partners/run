import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { EntityDeleteModal } from './EntityDeleteModal'

const meta: Meta<typeof EntityDeleteModal> = {
  title: 'Organisms/EntityDeleteModal',
  component: EntityDeleteModal,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    onConfirm: fn(),
  },
}
export default meta
type Story = StoryObj<typeof EntityDeleteModal>

export const Default: Story = {
  args: {
    entityName: 'Customers',
    rowCount: 1247,
  },
}

export const SmallEntity: Story = {
  name: 'Small Entity',
  args: {
    entityName: 'Categories',
    rowCount: 5,
  },
}
