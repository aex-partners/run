import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { FormFieldEditor } from './FormFieldEditor'
import type { GridColumn } from '../DataGrid/types'

const allColumns: GridColumn[] = [
  { id: 'autonumber', label: 'ID (Autonumber)', type: 'autonumber' },
  { id: 'text', label: 'Nome', type: 'text' },
  { id: 'long_text', label: 'Descricao', type: 'long_text' },
  { id: 'number', label: 'Quantidade', type: 'number' },
  { id: 'decimal', label: 'Desconto', type: 'decimal', decimalPlaces: 2 },
  { id: 'currency', label: 'Valor', type: 'currency', currencyCode: 'BRL' },
  { id: 'percent', label: 'Margem', type: 'percent' },
  { id: 'date', label: 'Data de Criacao', type: 'date' },
  { id: 'datetime', label: 'Ultima Atualizacao', type: 'datetime' },
  { id: 'duration', label: 'Duracao', type: 'duration' },
  { id: 'checkbox', label: 'Ativo', type: 'checkbox' },
  { id: 'select', label: 'Categoria', type: 'select', options: [
    { value: 'eletronicos', label: 'Eletronicos', color: '#2563eb' },
    { value: 'roupas', label: 'Roupas', color: '#8b5cf6' },
    { value: 'alimentos', label: 'Alimentos', color: '#16a34a' },
    { value: 'servicos', label: 'Servicos', color: '#ea580c' },
  ] },
  { id: 'multiselect', label: 'Tags', type: 'multiselect', options: [
    { value: 'destaque', label: 'Destaque', color: '#ea580c' },
    { value: 'promocao', label: 'Promocao', color: '#16a34a' },
    { value: 'novo', label: 'Novo', color: '#2563eb' },
  ] },
  { id: 'status', label: 'Status', type: 'status', options: [
    { value: 'ativo', label: 'Ativo', color: '#16a34a' },
    { value: 'inativo', label: 'Inativo', color: '#dc2626' },
    { value: 'pendente', label: 'Pendente', color: '#d97706' },
  ] },
  { id: 'priority', label: 'Prioridade', type: 'priority', options: [
    { value: 'critica', label: 'Critica', color: '#dc2626' },
    { value: 'alta', label: 'Alta', color: '#ea580c' },
    { value: 'media', label: 'Media', color: '#d97706' },
    { value: 'baixa', label: 'Baixa', color: '#2563eb' },
  ] },
  { id: 'rating', label: 'Avaliacao', type: 'rating', maxRating: 5 },
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'url', label: 'Site', type: 'url' },
  { id: 'phone', label: 'Telefone', type: 'phone' },
  { id: 'person', label: 'Responsavel', type: 'person' },
  { id: 'relationship', label: 'Cliente', type: 'relationship', relationshipEntityId: 'clientes' },
  { id: 'formula', label: 'Total Calculado', type: 'formula' },
  { id: 'barcode', label: 'Codigo de Barras', type: 'barcode' },
  { id: 'ai', label: 'Resumo IA', type: 'ai', aiPrompt: 'Summarize {nome}' },
  { id: 'attachment', label: 'Anexo', type: 'attachment' },
  { id: 'json', label: 'Dados JSON', type: 'json' },
  { id: 'rich_text', label: 'Observacoes', type: 'rich_text' },
  { id: 'created_at', label: 'Criado em', type: 'created_at' },
  { id: 'updated_at', label: 'Atualizado em', type: 'updated_at' },
  { id: 'created_by', label: 'Criado por', type: 'created_by' },
  { id: 'updated_by', label: 'Atualizado por', type: 'updated_by' },
]

const defaultValues: Record<string, string> = {
  autonumber: '1',
  text: 'Notebook Gamer Pro',
  long_text: 'Notebook com RTX 4070, 32GB RAM, ideal para desenvolvimento e jogos pesados',
  number: '15',
  decimal: '12.50',
  currency: '8999.90',
  percent: '35',
  date: '2026-01-15',
  datetime: '2026-03-20T14:30',
  duration: '02:30',
  checkbox: 'true',
  select: 'eletronicos',
  multiselect: 'destaque,novo',
  status: 'ativo',
  priority: 'alta',
  rating: '4',
  email: 'vendas@techbr.com.br',
  url: 'https://techbr.com.br',
  phone: '+55 11 3456-7890',
  person: 'Ana Paula Silva',
  relationship: 'TechBR Distribuidora',
  formula: '134998.50',
  barcode: '7891234567890',
  ai: 'Notebook topo de linha para publico gamer e profissional.',
  attachment: 'ficha-tecnica.pdf',
  json: '{ "cor": "preto", "garantia_meses": 12 }',
  rich_text: 'Produto em destaque na campanha de marco. Verificar estoque no CD de Barueri.',
  created_at: '2026-01-15 10:00:00',
  updated_at: '2026-03-20 14:30:00',
  created_by: 'Ana Paula Silva',
  updated_by: 'Carlos Eduardo Mendes',
}

function AllFieldTypesRenderer() {
  const [values, setValues] = useState<Record<string, string>>(defaultValues)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111', margin: 0 }}>
        Cadastro de Produto
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
        Formulario com todos os tipos de campo suportados.
      </p>
      {allColumns.map(col => (
        <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
            {col.label}
            <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
              ({col.type})
            </span>
          </label>
          <FormFieldEditor
            column={col}
            value={values[col.id] ?? ''}
            onChange={v => setValues(prev => ({ ...prev, [col.id]: v }))}
          />
        </div>
      ))}
    </div>
  )
}

function SingleFieldRenderer({ column, value, onChange }: { column: GridColumn; value: string; onChange: (v: string) => void }) {
  const [val, setVal] = useState(value)
  const handleChange = (v: string) => {
    setVal(v)
    onChange(v)
  }
  return (
    <div style={{ maxWidth: 400, padding: 24 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>
        {column.label}
        <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
          ({column.type})
        </span>
      </label>
      <FormFieldEditor column={column} value={val} onChange={handleChange} />
    </div>
  )
}

const meta: Meta<typeof FormFieldEditor> = {
  title: 'Organisms/FormFieldEditor',
  component: FormFieldEditor,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onChange: { action: 'change' },
  },
  args: {
    onChange: fn(),
  },
}
export default meta
type Story = StoryObj<typeof FormFieldEditor>

export const TextInput: Story = {
  args: {
    column: { id: 'nome', label: 'Nome', type: 'text' },
    value: 'Notebook Gamer Pro',
  },
}

export const CurrencyInput: Story = {
  args: {
    column: { id: 'valor', label: 'Valor', type: 'currency', currencyCode: 'BRL' },
    value: '8999.90',
  },
}

export const SelectInput: Story = {
  args: {
    column: { id: 'categoria', label: 'Categoria', type: 'select', options: [
      { value: 'eletronicos', label: 'Eletronicos', color: '#2563eb' },
      { value: 'roupas', label: 'Roupas', color: '#8b5cf6' },
      { value: 'alimentos', label: 'Alimentos', color: '#16a34a' },
    ] },
    value: 'eletronicos',
  },
}

export const RatingInput: Story = {
  render: () => (
    <SingleFieldRenderer
      column={{ id: 'avaliacao', label: 'Avaliacao', type: 'rating', maxRating: 5 }}
      value="4"
      onChange={fn()}
    />
  ),
}

export const CheckboxInput: Story = {
  args: {
    column: { id: 'ativo', label: 'Ativo', type: 'checkbox' },
    value: 'true',
  },
}

/** Every supported field type rendered in a single form layout with pre-filled Brazilian product data. */
export const AllFieldTypes: Story = {
  render: () => <AllFieldTypesRenderer />,
  parameters: { layout: 'padded' },
}
