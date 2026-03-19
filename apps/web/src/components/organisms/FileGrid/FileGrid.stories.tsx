import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { FileGrid } from './FileGrid'
import type { FileItemData } from '../../molecules/FileItem/FileItem'

const mockFiles: FileItemData[] = [
  {
    id: 'f1',
    name: 'Notas Fiscais 2026',
    type: 'folder',
    size: '24 files',
    modifiedAt: 'Mar 13',
    source: 'upload',
    isFolder: true,
    parentId: null,
  },
  {
    id: 'f2',
    name: 'Contratos',
    type: 'folder',
    size: '8 files',
    modifiedAt: 'Mar 10',
    source: 'upload',
    isFolder: true,
    parentId: null,
  },
  {
    id: '1',
    name: 'proposta-comercial-lote-4420.pdf',
    type: 'pdf',
    size: '2.4 MB',
    modifiedAt: 'Mar 13',
    modifiedBy: 'Roberto Almeida',
    source: 'email',
    starred: true,
    parentId: null,
  },
  {
    id: '2',
    name: 'catalogo-precos.xlsx',
    type: 'xlsx',
    size: '890 KB',
    modifiedAt: 'Mar 13',
    modifiedBy: 'Roberto Almeida',
    source: 'email',
    parentId: null,
  },
  {
    id: '3',
    name: 'analise-orcamento-q1-2026.pdf',
    type: 'pdf',
    size: '156 KB',
    modifiedAt: 'Mar 12',
    source: 'generated',
    parentId: null,
  },
  {
    id: '4',
    name: 'screenshot-dashboard-vendas.png',
    type: 'png',
    size: '1.2 MB',
    modifiedAt: 'Mar 11',
    modifiedBy: 'Carlos Mendes',
    source: 'chat',
    parentId: null,
  },
  {
    id: '5',
    name: 'planilha-estoque-atualizada.csv',
    type: 'csv',
    size: '340 KB',
    modifiedAt: 'Mar 9',
    source: 'workflow',
    parentId: null,
  },
  {
    id: '6',
    name: 'logo-empresa.svg',
    type: 'svg',
    size: '24 KB',
    modifiedAt: 'Mar 8',
    source: 'upload',
    parentId: null,
  },
]

const meta: Meta<typeof FileGrid> = {
  title: 'Organisms/FileGrid',
  component: FileGrid,
  tags: ['files'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    view: { control: 'radio', options: ['list', 'grid'] },
    loading: { control: 'boolean' },
  },
  args: {
    onFileClick: fn(),
    onFileDoubleClick: fn(),
    onFileStar: fn(),
    onFileSelect: fn(),
    onSelectAll: fn(),
    onDelete: fn(),
    onDownload: fn(),
    onRefresh: fn(),
    onViewChange: fn(),
    onNavigateUp: fn(),
    onBreadcrumbClick: fn(),
    onSort: fn(),
  },
  decorators: [(Story) => <div style={{ height: '100vh' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof FileGrid>

export const ListView: Story = {
  args: {
    files: mockFiles,
    view: 'list',
  },
}

export const GridView: Story = {
  args: {
    files: mockFiles,
    view: 'grid',
  },
}

export const WithSelection: Story = {
  args: {
    files: mockFiles,
    view: 'list',
    selectedIds: new Set(['1', '3', '4']),
  },
}

export const InSubfolder: Story = {
  args: {
    files: mockFiles.filter((f) => !f.isFolder),
    view: 'list',
    currentPath: ['Notas Fiscais 2026'],
  },
}

export const DeepSubfolder: Story = {
  args: {
    files: mockFiles.filter((f) => !f.isFolder).slice(0, 2),
    view: 'list',
    currentPath: ['Notas Fiscais 2026', 'Janeiro'],
  },
}

export const Empty: Story = {
  args: {
    files: [],
    view: 'list',
  },
}
