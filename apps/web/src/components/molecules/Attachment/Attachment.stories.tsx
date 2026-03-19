import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Attachment } from './Attachment'

const meta: Meta<typeof Attachment> = {
  title: 'Molecules/Attachment',
  component: Attachment,
  tags: ['ai'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    variant: { control: 'radio', options: ['grid', 'inline'] },
    onRemove: { action: 'removed' },
  },
  args: { onRemove: fn() },
}
export default meta
type Story = StoryObj<typeof Attachment>

export const GridDefault: Story = {
  args: {
    fileName: 'relatorio-vendas-q1.pdf',
    fileSize: '2.4 MB',
    fileType: 'application/pdf',
    variant: 'grid',
  },
}

export const GridWithThumbnail: Story = {
  args: {
    fileName: 'foto-produto.jpg',
    fileSize: '890 KB',
    fileType: 'image/jpeg',
    thumbnailUrl: 'https://placehold.co/80x80/f3f4f6/6b7280?text=IMG',
    variant: 'grid',
  },
}

export const InlineChip: Story = {
  args: {
    fileName: 'planilha-estoque.xlsx',
    fileSize: '1.1 MB',
    fileType: 'application/spreadsheet',
    variant: 'inline',
  },
}

export const GridCollection: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <Attachment fileName="contrato-fornecedor.pdf" fileSize="3.2 MB" fileType="application/pdf" variant="grid" />
      <Attachment fileName="logo-empresa.png" fileSize="120 KB" fileType="image/png" variant="grid" />
      <Attachment fileName="dados-importacao.csv" fileSize="540 KB" fileType="text/csv" variant="grid" />
    </div>
  ),
}

export const InlineCollection: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      <Attachment fileName="relatorio.pdf" fileSize="2.4 MB" fileType="application/pdf" variant="inline" onRemove={fn()} />
      <Attachment fileName="foto.jpg" fileSize="890 KB" fileType="image/jpeg" variant="inline" onRemove={fn()} />
      <Attachment fileName="dados.xlsx" fileSize="1.1 MB" fileType="application/spreadsheet" variant="inline" onRemove={fn()} />
    </div>
  ),
}
