import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { FilesScreen } from './FilesScreen'
import type { FileItemData } from '../../molecules/FileItem/FileItem'

// Hierarchical mock data using parentId
const mockFiles: FileItemData[] = [
  // === ROOT level (parentId: null/undefined) ===
  // Folders at root
  {
    id: 'f1',
    name: 'Notas Fiscais 2026',
    type: 'folder',
    size: '5 files',
    modifiedAt: 'Mar 13',
    source: 'upload',
    isFolder: true,
    parentId: null,
  },
  {
    id: 'f2',
    name: 'Contratos Fornecedores',
    type: 'folder',
    size: '3 files',
    modifiedAt: 'Mar 10',
    source: 'upload',
    isFolder: true,
    parentId: null,
  },
  {
    id: 'f3',
    name: 'Relatorios Mensais',
    type: 'folder',
    size: '4 files',
    modifiedAt: 'Mar 8',
    source: 'generated',
    isFolder: true,
    parentId: null,
  },
  {
    id: 'f4',
    name: 'Fotos Estoque',
    type: 'folder',
    size: '2 files',
    modifiedAt: 'Mar 11',
    source: 'chat',
    isFolder: true,
    parentId: null,
  },
  // Files at root
  {
    id: '1',
    name: 'proposta-comercial-lote-4420.pdf',
    type: 'pdf',
    size: '2.4 MB',
    modifiedAt: 'Mar 13',
    modifiedBy: 'Roberto Almeida',
    source: 'email',
    sourceRef: 'Email: Proposta comercial - Lote #4420',
    starred: true,
    aiIndexed: true,
    parentId: null,
  },
  {
    id: '2',
    name: 'catalogo-precos-acme.xlsx',
    type: 'xlsx',
    size: '890 KB',
    modifiedAt: 'Mar 13',
    modifiedBy: 'Roberto Almeida',
    source: 'email',
    parentId: null,
  },
  {
    id: '10',
    name: 'planilha-estoque-atualizada.csv',
    type: 'csv',
    size: '340 KB',
    modifiedAt: 'Mar 13',
    source: 'workflow',
    sourceRef: 'Workflow: Atualizacao diaria de estoque',
    parentId: null,
  },
  {
    id: '12',
    name: 'logo-empresa.svg',
    type: 'svg',
    size: '24 KB',
    modifiedAt: 'Mar 5',
    source: 'upload',
    parentId: null,
  },

  // === INSIDE "Notas Fiscais 2026" (parentId: f1) ===
  {
    id: 'f1-sub',
    name: 'Janeiro',
    type: 'folder',
    size: '2 files',
    modifiedAt: 'Jan 31',
    source: 'upload',
    isFolder: true,
    parentId: 'f1',
  },
  {
    id: 'nf1',
    name: 'NF-8821-distribuidora-sul.pdf',
    type: 'pdf',
    size: '320 KB',
    modifiedAt: 'Mar 13',
    source: 'email',
    sourceRef: 'Email: NF-e #8821 autorizada',
    parentId: 'f1',
  },
  {
    id: 'nf2',
    name: 'NF-8790-acme-materiais.pdf',
    type: 'pdf',
    size: '285 KB',
    modifiedAt: 'Mar 10',
    source: 'email',
    parentId: 'f1',
  },
  {
    id: 'nf3',
    name: 'NF-8756-fornecedor-abc.pdf',
    type: 'pdf',
    size: '310 KB',
    modifiedAt: 'Mar 5',
    source: 'email',
    parentId: 'f1',
  },
  {
    id: 'nf4',
    name: 'resumo-notas-marco.xlsx',
    type: 'xlsx',
    size: '120 KB',
    modifiedAt: 'Mar 13',
    source: 'generated',
    parentId: 'f1',
  },

  // === INSIDE "Janeiro" subfolder (parentId: f1-sub) ===
  {
    id: 'nf-jan1',
    name: 'NF-8501-janeiro-transportes.pdf',
    type: 'pdf',
    size: '290 KB',
    modifiedAt: 'Jan 15',
    source: 'email',
    parentId: 'f1-sub',
  },
  {
    id: 'nf-jan2',
    name: 'NF-8520-janeiro-materiais.pdf',
    type: 'pdf',
    size: '310 KB',
    modifiedAt: 'Jan 28',
    source: 'email',
    parentId: 'f1-sub',
  },

  // === INSIDE "Contratos Fornecedores" (parentId: f2) ===
  {
    id: 'ct1',
    name: 'contrato-acme-materiais-2026.pdf',
    type: 'pdf',
    size: '3.1 MB',
    modifiedAt: 'Mar 9',
    source: 'email',
    starred: true,
    parentId: 'f2',
  },
  {
    id: 'ct2',
    name: 'contrato-distribuidora-sul.pdf',
    type: 'pdf',
    size: '2.8 MB',
    modifiedAt: 'Feb 20',
    source: 'upload',
    parentId: 'f2',
  },
  {
    id: 'ct3',
    name: 'contrato-transportadora-rapida.pdf',
    type: 'pdf',
    size: '1.9 MB',
    modifiedAt: 'Feb 15',
    source: 'upload',
    parentId: 'f2',
  },

  // === INSIDE "Relatorios Mensais" (parentId: f3) ===
  {
    id: 'rel1',
    name: 'relatorio-vendas-fevereiro-2026.xlsx',
    type: 'xlsx',
    size: '1.5 MB',
    modifiedAt: 'Mar 10',
    modifiedBy: 'Ana Paula Santos',
    source: 'email',
    starred: true,
    parentId: 'f3',
  },
  {
    id: 'rel2',
    name: 'analise-orcamento-q1-2026.pdf',
    type: 'pdf',
    size: '156 KB',
    modifiedAt: 'Mar 12',
    source: 'generated',
    parentId: 'f3',
  },
  {
    id: 'rel3',
    name: 'resumo-reuniao-diretoria-12mar.pdf',
    type: 'pdf',
    size: '98 KB',
    modifiedAt: 'Mar 12',
    source: 'generated',
    parentId: 'f3',
  },
  {
    id: 'rel4',
    name: 'previsao-vendas-marco-2026.xlsx',
    type: 'xlsx',
    size: '210 KB',
    modifiedAt: 'Mar 11',
    source: 'generated',
    parentId: 'f3',
  },

  // === INSIDE "Fotos Estoque" (parentId: f4) ===
  {
    id: 'foto1',
    name: 'screenshot-dashboard-vendas.png',
    type: 'png',
    size: '1.2 MB',
    modifiedAt: 'Mar 11',
    modifiedBy: 'Carlos Mendes',
    source: 'chat',
    sourceRef: 'Chat: #vendas',
    parentId: 'f4',
  },
  {
    id: 'foto2',
    name: 'foto-estoque-galpao-a.jpg',
    type: 'jpg',
    size: '3.8 MB',
    modifiedAt: 'Mar 10',
    modifiedBy: 'Marcos Silva',
    source: 'chat',
    sourceRef: 'Chat: #logistica',
    parentId: 'f4',
  },
]

const meta: Meta<typeof FilesScreen> = {
  title: 'Screens/FilesScreen',
  component: FilesScreen,
  tags: ['screen', 'files'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    activeCategory: { control: 'select', options: ['all', 'starred', 'recent', 'shared', 'trash'] },
    loading: { control: 'boolean' },
  },
  args: {
    onCategoryChange: fn(),
    onFileClick: fn(),
    onFileDoubleClick: fn(),
    onFileStar: fn(),
    onUpload: fn(),
    onNewFolder: fn(),
    onDelete: fn(),
    onDownload: fn(),
    onShare: fn(),
    onRefresh: fn(),
    onAiAction: fn(),
    onToggleAiIndex: fn(),
    onTogglePublicLink: fn(),
    onCopyShareLink: fn(),
    onAddShareUser: fn(),
    onRemoveShareUser: fn(),
    onChangeShareAccess: fn(),
    getShareData: () => ({
      publicLink: 'https://files.aex.app/share/abc123',
      publicEnabled: true,
      sharedWith: [
        { id: '1', name: 'Roberto Almeida', email: 'roberto@acme.com.br', access: 'viewer' as const },
        { id: '2', name: 'Ana Paula Santos', email: 'ana.paula@empresa.com', access: 'editor' as const },
      ],
    }),
    canDelete: () => true,
  },
  decorators: [(Story) => <div style={{ height: '100vh' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof FilesScreen>

export const Default: Story = {
  args: {
    files: mockFiles,
    activeCategory: 'all',
    categoryCounts: { all: 24, starred: 3, recent: 10, shared: 5, trash: 0 },
  },
}

export const StarredFiles: Story = {
  args: {
    files: mockFiles,
    activeCategory: 'starred',
    categoryCounts: { all: 24, starred: 3, recent: 10, shared: 5, trash: 0 },
  },
}

export const EmptyTrash: Story = {
  args: {
    files: mockFiles,
    activeCategory: 'trash',
    categoryCounts: { all: 24, starred: 3, recent: 10 },
  },
}

export const NoDeletePermission: Story = {
  args: {
    files: mockFiles,
    activeCategory: 'all',
    categoryCounts: { all: 24, starred: 3, recent: 10, shared: 5, trash: 0 },
    canDelete: () => false,
  },
}
