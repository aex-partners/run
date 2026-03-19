import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { FileDeleteDialog } from './FileDeleteDialog'

const meta: Meta<typeof FileDeleteDialog> = {
  title: 'Organisms/FileDeleteDialog',
  component: FileDeleteDialog,
  tags: ['files'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    open: true,
    onConfirm: fn(),
    onClose: fn(),
  },
}
export default meta
type Story = StoryObj<typeof FileDeleteDialog>

export const SingleFile: Story = {
  args: {
    fileNames: ['proposta-comercial-lote-4420.pdf'],
    hasPermission: true,
  },
}

export const MultipleFiles: Story = {
  args: {
    fileNames: [
      'proposta-comercial-lote-4420.pdf',
      'catalogo-precos-acme.xlsx',
      'nota-fiscal-9821.pdf',
    ],
    hasPermission: true,
  },
}

export const DeleteFolder: Story = {
  args: {
    fileNames: ['Notas Fiscais 2026'],
    isFolder: true,
    hasPermission: true,
  },
}

export const BulkDelete: Story = {
  args: {
    fileNames: Array.from({ length: 12 }, (_, i) => `arquivo-${i + 1}.pdf`),
    hasPermission: true,
  },
}

export const NoPermission: Story = {
  args: {
    fileNames: ['contrato-confidencial.pdf'],
    hasPermission: false,
  },
}

export const NoPermissionFolder: Story = {
  args: {
    fileNames: ['Contratos Fornecedores'],
    isFolder: true,
    hasPermission: false,
  },
}
