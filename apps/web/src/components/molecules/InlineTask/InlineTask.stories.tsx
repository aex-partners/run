import type { Meta, StoryObj } from '@storybook/react'
import { InlineTask } from './InlineTask'

const meta: Meta<typeof InlineTask> = {
  title: 'Molecules/InlineTask',
  component: InlineTask,
  tags: ['ai'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    status: { control: 'radio', options: ['pending', 'in-progress', 'completed', 'error'] },
    defaultOpen: { control: 'boolean' },
  },
}
export default meta
type Story = StoryObj<typeof InlineTask>

export const InProgress: Story = {
  args: {
    title: 'Importando planilha de produtos',
    status: 'in-progress',
    progress: { current: 3, total: 7 },
    defaultOpen: true,
    files: [
      { name: 'produtos-eletronicos.csv', type: 'text/csv' },
      { name: 'fotos-catalogo.zip', type: 'application/zip' },
      { name: 'precos-atacado.xlsx', type: 'application/spreadsheet' },
    ],
  },
}

export const Completed: Story = {
  args: {
    title: 'Backup do banco de dados',
    status: 'completed',
    progress: { current: 5, total: 5 },
    defaultOpen: true,
    files: [
      { name: 'backup-2026-03-13.sql', type: 'application/sql' },
      { name: 'schema-snapshot.json', type: 'application/json' },
    ],
  },
}

export const Error: Story = {
  args: {
    title: 'Sincronizar com API externa',
    status: 'error',
    progress: { current: 2, total: 4 },
    defaultOpen: true,
    files: [
      { name: 'log-erro.txt', type: 'text/plain' },
    ],
  },
}

export const Pending: Story = {
  args: {
    title: 'Gerar relatorio de vendas',
    status: 'pending',
  },
}

export const NoFiles: Story = {
  args: {
    title: 'Calculando metricas de performance',
    status: 'in-progress',
    progress: { current: 1, total: 3 },
    defaultOpen: true,
  },
}
