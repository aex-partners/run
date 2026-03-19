import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { FileItem } from './FileItem'

const meta: Meta<typeof FileItem> = {
  title: 'Molecules/FileItem',
  component: FileItem,
  tags: ['files'],
  parameters: {
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    view: { control: 'radio', options: ['list', 'grid'] },
    source: { control: 'select', options: ['email', 'chat', 'generated', 'upload', 'workflow'] },
  },
  args: {
    onClick: fn(),
    onDoubleClick: fn(),
    onStar: fn(),
    onSelect: fn(),
    onContextMenu: fn(),
  },
}
export default meta
type Story = StoryObj<typeof FileItem>

export const PdfFile: Story = {
  args: {
    id: '1',
    name: 'proposta-comercial-lote-4420.pdf',
    type: 'pdf',
    size: '2.4 MB',
    modifiedAt: 'Mar 13',
    modifiedBy: 'Roberto Almeida',
    source: 'email',
    starred: true,
    view: 'list',
  },
}

export const Spreadsheet: Story = {
  args: {
    id: '2',
    name: 'relatorio-vendas-fev-2026.xlsx',
    type: 'xlsx',
    size: '890 KB',
    modifiedAt: 'Mar 10',
    modifiedBy: 'Ana Paula Santos',
    source: 'email',
    view: 'list',
  },
}

export const AiGenerated: Story = {
  args: {
    id: '3',
    name: 'analise-orcamento-q1-2026.pdf',
    type: 'pdf',
    size: '156 KB',
    modifiedAt: 'Mar 12',
    source: 'generated',
    view: 'list',
  },
}

export const ChatAttachment: Story = {
  args: {
    id: '4',
    name: 'screenshot-dashboard.png',
    type: 'png',
    size: '1.2 MB',
    modifiedAt: 'Mar 11',
    modifiedBy: 'Carlos Mendes',
    source: 'chat',
    view: 'list',
  },
}

export const Folder: Story = {
  args: {
    id: '5',
    name: 'Notas Fiscais 2026',
    type: 'folder',
    size: '24 files',
    modifiedAt: 'Mar 13',
    source: 'upload',
    isFolder: true,
    view: 'list',
  },
}

export const GridView: Story = {
  args: {
    id: '6',
    name: 'contrato-fornecedor-acme.pdf',
    type: 'pdf',
    size: '3.1 MB',
    modifiedAt: 'Mar 9',
    source: 'email',
    starred: true,
    view: 'grid',
  },
}

export const Selected: Story = {
  args: {
    id: '7',
    name: 'catalogo-produtos.xlsx',
    type: 'xlsx',
    size: '4.5 MB',
    modifiedAt: 'Mar 8',
    source: 'upload',
    selected: true,
    view: 'list',
  },
}
