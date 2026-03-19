import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { FilePreview } from './FilePreview'

const meta: Meta<typeof FilePreview> = {
  title: 'Organisms/FilePreview',
  component: FilePreview,
  tags: ['files'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    onClose: fn(),
    onDownload: fn(),
    onShare: fn(),
    onDelete: fn(),
    onStar: fn(),
    onOpenSource: fn(),
    onToggleAiIndex: fn(),
  },
  decorators: [(Story) => <div style={{ height: '100vh' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof FilePreview>

export const PdfFromEmail: Story = {
  args: {
    id: '1',
    name: 'proposta-comercial-lote-4420.pdf',
    type: 'pdf',
    size: '2.4 MB',
    modifiedAt: 'Mar 13, 10:32',
    modifiedBy: 'Roberto Almeida',
    source: 'email',
    sourceRef: 'Email: Proposta comercial - Lote #4420',
    starred: true,
    aiIndexed: true,
    aiSummary: 'Commercial proposal from Acme Materials. 3 construction items totaling R$ 47,450. Payment: 30/60/90 days. Valid until March 20.',
  },
}

export const AiGenerated: Story = {
  args: {
    id: '2',
    name: 'analise-orcamento-q1-2026.pdf',
    type: 'pdf',
    size: '156 KB',
    modifiedAt: 'Mar 12, 14:20',
    source: 'generated',
    aiIndexed: true,
    aiSummary: 'Budget analysis for Q1 2026. Generated from financial data. Revenue up 12% compared to Q4 2025.',
  },
}

export const NotIndexed: Story = {
  args: {
    id: '3',
    name: 'contrato-confidencial.pdf',
    type: 'pdf',
    size: '5.1 MB',
    modifiedAt: 'Mar 10, 09:00',
    source: 'upload',
    aiIndexed: false,
  },
}

export const FolderPreview: Story = {
  args: {
    id: 'f1',
    name: 'Notas Fiscais 2026',
    type: 'folder',
    size: '24 files',
    modifiedAt: 'Mar 13',
    source: 'upload',
    isFolder: true,
    aiIndexed: true,
  },
}

export const ImageFromChat: Story = {
  args: {
    id: '4',
    name: 'screenshot-dashboard-vendas.png',
    type: 'png',
    size: '1.2 MB',
    modifiedAt: 'Mar 11, 16:45',
    modifiedBy: 'Carlos Mendes',
    source: 'chat',
    sourceRef: 'Chat: #vendas',
    aiIndexed: false,
  },
}
