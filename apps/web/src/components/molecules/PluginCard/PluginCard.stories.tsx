import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { FileText, MessageSquare, Package, Table } from 'lucide-react'
import { PluginCard } from './PluginCard'

const meta: Meta<typeof PluginCard> = {
  title: 'Molecules/PluginCard',
  component: PluginCard,
  tags: ['settings'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    installed: { control: 'boolean' },
    installing: { control: 'boolean' },
    enabled: { control: 'boolean' },
    toolCount: { control: 'number' },
    onInstall: { action: 'install' },
    onConfigure: { action: 'configure' },
    onUninstall: { action: 'uninstall' },
    onToggle: { action: 'toggle' },
  },
  args: { onInstall: fn(), onConfigure: fn(), onUninstall: fn(), onToggle: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 600 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof PluginCard>

/** Not installed — shows the Install button. */
export const NotInstalled: Story = {
  args: {
    name: 'Mercado Livre',
    description: 'Sync products and orders with Mercado Livre',
    icon: <Package size={20} />,
    installed: false,
    category: 'E-commerce',
    rating: 4.9,
  },
}

/** Installed — shows Configure, Uninstall buttons, and toggle switch. */
export const Installed: Story = {
  args: {
    name: 'WhatsApp Business',
    description: 'Send notifications and handle support via WhatsApp',
    icon: <MessageSquare size={20} />,
    installed: true,
    enabled: true,
    version: '1.3.0',
    category: 'Communication',
    rating: 4.5,
    toolCount: 3,
    onUninstall: fn(),
    onToggle: fn(),
  },
}

/** Installed but disabled — toggle is off. */
export const InstalledDisabled: Story = {
  args: {
    name: 'WhatsApp Business',
    description: 'Send notifications and handle support via WhatsApp',
    icon: <MessageSquare size={20} />,
    installed: true,
    enabled: false,
    version: '1.3.0',
    category: 'Communication',
    toolCount: 3,
    onUninstall: fn(),
    onToggle: fn(),
  },
}

/** Install in progress — Install button shows a loading spinner. */
export const Installing: Story = {
  args: {
    name: 'Google Sheets',
    description: 'Export and sync data with Google Sheets',
    icon: <FileText size={20} />,
    installed: false,
    installing: true,
    category: 'Data',
    rating: 4.3,
  },
}

/** Plugin without a rating prop — rating section should not render. */
export const WithoutRating: Story = {
  args: {
    name: 'NF-e Integration',
    description: 'Issue and query electronic invoices via SEFAZ',
    icon: <Table size={20} />,
    installed: false,
    version: '2.1.4',
    category: 'Fiscal',
  },
}
