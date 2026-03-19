import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Inbox, Send, FileText, AlertTriangle, Trash2, Star } from 'lucide-react'
import { MailFolderItem } from './MailFolderItem'

const meta: Meta<typeof MailFolderItem> = {
  title: 'Molecules/MailFolderItem',
  component: MailFolderItem,
  tags: ['mail'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    active: { control: 'boolean' },
    count: { control: 'number' },
  },
  args: { onClick: fn() },
  decorators: [(Story) => <div style={{ width: 220 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof MailFolderItem>

export const Default: Story = {
  args: {
    icon: <Inbox size={16} />,
    label: 'Inbox',
    count: 12,
  },
}

export const Active: Story = {
  args: {
    icon: <Inbox size={16} />,
    label: 'Inbox',
    count: 12,
    active: true,
  },
}

export const NoCount: Story = {
  args: {
    icon: <Send size={16} />,
    label: 'Sent',
  },
}

export const AllFolders: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <MailFolderItem icon={<Inbox size={16} />} label="Inbox" count={12} active />
      <MailFolderItem icon={<Star size={16} />} label="Starred" count={3} />
      <MailFolderItem icon={<Send size={16} />} label="Sent" />
      <MailFolderItem icon={<FileText size={16} />} label="Drafts" count={2} />
      <MailFolderItem icon={<AlertTriangle size={16} />} label="Spam" count={5} />
      <MailFolderItem icon={<Trash2 size={16} />} label="Trash" />
    </div>
  ),
}
