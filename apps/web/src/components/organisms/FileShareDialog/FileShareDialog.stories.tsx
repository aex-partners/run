import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { FileShareDialog, type SharedUser } from './FileShareDialog'

// Stateful wrapper for interactive stories
function StatefulShareDialog(props: React.ComponentProps<typeof FileShareDialog>) {
  const [publicEnabled, setPublicEnabled] = useState(props.publicEnabled ?? false)
  const [sharedWith, setSharedWith] = useState<SharedUser[]>(props.sharedWith ?? [])

  return (
    <FileShareDialog
      {...props}
      publicEnabled={publicEnabled}
      sharedWith={sharedWith}
      onTogglePublic={(enabled) => {
        setPublicEnabled(enabled)
        props.onTogglePublic?.(enabled)
      }}
      onAddUser={(email, access) => {
        const newUser: SharedUser = {
          id: `user-${Date.now()}`,
          name: email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          email,
          access,
        }
        setSharedWith((prev) => [...prev, newUser])
        props.onAddUser?.(email, access)
      }}
      onRemoveUser={(userId) => {
        setSharedWith((prev) => prev.filter((u) => u.id !== userId))
        props.onRemoveUser?.(userId)
      }}
      onChangeAccess={(userId, access) => {
        setSharedWith((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, access } : u))
        )
        props.onChangeAccess?.(userId, access)
      }}
    />
  )
}

const meta: Meta<typeof FileShareDialog> = {
  title: 'Organisms/FileShareDialog',
  component: FileShareDialog,
  tags: ['files'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    open: true,
    onClose: fn(),
    onTogglePublic: fn(),
    onCopyLink: fn(),
    onAddUser: fn(),
    onRemoveUser: fn(),
    onChangeAccess: fn(),
  },
}
export default meta
type Story = StoryObj<typeof FileShareDialog>

export const NewShare: Story = {
  args: {
    fileName: 'proposta-comercial-lote-4420.pdf',
    publicEnabled: false,
  },
  render: (args) => <StatefulShareDialog {...args} />,
}

export const WithPublicLink: Story = {
  args: {
    fileName: 'relatorio-vendas-fevereiro-2026.xlsx',
    publicEnabled: true,
    publicLink: 'https://files.aex.app/share/f8a2c91d-3e4f-4b7a',
  },
  render: (args) => <StatefulShareDialog {...args} />,
}

export const WithSharedUsers: Story = {
  args: {
    fileName: 'contrato-acme-materiais-2026.pdf',
    publicEnabled: true,
    publicLink: 'https://files.aex.app/share/a1b2c3d4',
    sharedWith: [
      { id: '1', name: 'Roberto Almeida', email: 'roberto@acme.com.br', access: 'viewer' },
      { id: '2', name: 'Ana Paula Santos', email: 'ana.paula@empresa.com', access: 'editor' },
      { id: '3', name: 'Carlos Mendes', email: 'carlos@logistics.com', access: 'viewer' },
    ],
  },
  render: (args) => <StatefulShareDialog {...args} />,
}

export const ShareFolder: Story = {
  args: {
    fileName: 'Notas Fiscais 2026',
    isFolder: true,
    publicEnabled: false,
    sharedWith: [
      { id: '1', name: 'Fernanda Costa', email: 'fernanda@distribuidora.com', access: 'editor' },
    ],
  },
  render: (args) => <StatefulShareDialog {...args} />,
}
