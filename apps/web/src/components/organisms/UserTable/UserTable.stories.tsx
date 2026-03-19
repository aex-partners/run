import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { UserTable } from './UserTable'

const mockUsers = [
  { id: 'u1', name: 'Ana Lima', email: 'ana@company.com', role: 'Administrator', status: 'active' as const },
  { id: 'u2', name: 'Carlos Mendes', email: 'carlos@company.com', role: 'Manager', status: 'active' as const },
  { id: 'u3', name: 'Diana Rocha', email: 'diana@company.com', role: 'Sales Rep', status: 'active' as const },
  { id: 'u4', name: 'Eduardo Faria', email: 'eduardo@company.com', role: 'Stock Clerk', status: 'pending' as const },
  { id: 'u5', name: 'Fernanda Costa', email: 'fernanda@company.com', role: 'Finance', status: 'active' as const },
  { id: 'u6', name: 'Gabriel Souza', email: 'gabriel@company.com', role: 'Support', status: 'inactive' as const },
]

const meta: Meta<typeof UserTable> = {
  title: 'Organisms/UserTable',
  component: UserTable,
  tags: ['settings'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onEdit: { action: 'edit' },
    onInvite: { action: 'invite' },
    onDelete: { action: 'delete' },
    onChangeRole: { action: 'change-role' },
    onChangeStatus: { action: 'change-status' },
  },
  args: {
    onEdit: fn(),
    onInvite: fn(),
    onDelete: fn(),
    onChangeRole: fn(),
    onChangeStatus: fn(),
  },
}
export default meta
type Story = StoryObj<typeof UserTable>

export const Default: Story = {
  args: { users: mockUsers },
}

export const Empty: Story = {
  args: { users: [] },
}

/** Check the checkboxes to select users, then use the "Delete selected" toolbar that appears at the top. */
export const BulkActionsDemo: Story = {
  name: 'Bulk Actions Demo',
  args: { users: mockUsers },
}

/** Click any status badge to cycle through: active → pending → inactive → active. Check the Actions panel for callbacks. */
export const StatusCycling: Story = {
  args: { users: mockUsers },
}

/** Hover a user row and click the role text to open the dropdown and change their role. */
export const RoleChange: Story = {
  args: { users: mockUsers },
}

/** Table with a single user — verifies layout with minimal data. */
export const SingleUser: Story = {
  args: {
    users: [
      { id: 'u1', name: 'Ana Lima', email: 'ana@company.com', role: 'Administrator', status: 'active' as const },
    ],
  },
}
