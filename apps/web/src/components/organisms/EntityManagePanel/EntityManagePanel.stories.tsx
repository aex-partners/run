import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { EntityManagePanel } from './EntityManagePanel'
import type { EntityField, EntityRelationship, EntityVersion } from './EntityManagePanel'

const mockFields: EntityField[] = [
  {
    id: 'f1',
    name: 'name',
    type: 'text',
    description: 'Nome completo do cliente',
    required: true,
    unique: false,
  },
  {
    id: 'f2',
    name: 'email',
    type: 'email',
    description: 'Email principal de contato',
    required: true,
    unique: true,
  },
  {
    id: 'f3',
    name: 'phone',
    type: 'phone',
    description: 'Telefone com DDD',
    required: false,
  },
  {
    id: 'f4',
    name: 'status',
    type: 'status',
    description: 'Status do cadastro',
    required: true,
    options: [
      { value: 'active', label: 'Ativo', color: '#16a34a' },
      { value: 'inactive', label: 'Inativo', color: '#dc2626' },
      { value: 'pending', label: 'Pendente', color: '#d97706' },
    ],
  },
  {
    id: 'f5',
    name: 'total_orders',
    type: 'rollup',
    description: 'Total de pedidos vinculados',
    rollupFunction: 'count',
    relationshipEntityName: 'Orders',
  },
  {
    id: 'f6',
    name: 'revenue',
    type: 'currency',
    description: 'Receita total do cliente',
    currencyCode: 'BRL',
  },
  {
    id: 'f7',
    name: 'score',
    type: 'formula',
    description: 'Score calculado automaticamente',
    formula: '{total_orders} * 10 + IF({status} = "active", 50, 0)',
  },
  {
    id: 'f8',
    name: 'priority',
    type: 'priority',
    description: 'Nível de prioridade de atendimento',
    options: [
      { value: 'high', label: 'Alta', color: '#dc2626' },
      { value: 'medium', label: 'Média', color: '#d97706' },
      { value: 'low', label: 'Baixa', color: '#16a34a' },
    ],
  },
  {
    id: 'f9',
    name: 'created_at',
    type: 'created_at',
    description: 'Data de criação do registro',
  },
  {
    id: 'f10',
    name: 'updated_at',
    type: 'updated_at',
    description: 'Última atualização do registro',
  },
]

const mockRelationships: EntityRelationship[] = [
  {
    id: 'r1',
    name: 'customer_orders',
    type: 'one_to_many',
    sourceEntityId: 'customers',
    sourceEntityName: 'Customers',
    sourceFieldId: 'f1',
    sourceFieldName: 'id',
    targetEntityId: 'orders',
    targetEntityName: 'Orders',
    targetFieldId: 'customer_id',
    targetFieldName: 'customer_id',
  },
  {
    id: 'r2',
    name: 'customer_invoices',
    type: 'one_to_many',
    sourceEntityId: 'customers',
    sourceEntityName: 'Customers',
    sourceFieldId: 'f1',
    sourceFieldName: 'id',
    targetEntityId: 'invoices',
    targetEntityName: 'Invoices',
    targetFieldId: 'customer_id',
    targetFieldName: 'customer_id',
  },
  {
    id: 'r3',
    name: 'customer_tags',
    type: 'many_to_many',
    sourceEntityId: 'customers',
    sourceEntityName: 'Customers',
    sourceFieldId: 'f1',
    sourceFieldName: 'id',
    targetEntityId: 'tags',
    targetEntityName: 'Tags',
  },
]

const mockVersions: EntityVersion[] = [
  {
    id: 'v3',
    version: 3,
    createdAt: '2026-03-12 14:30',
    createdBy: 'Eric (AI)',
    changes: 'Added formula field "score" and rollup field "total_orders"',
    fieldCount: 10,
  },
  {
    id: 'v2',
    version: 2,
    createdAt: '2026-03-10 09:15',
    createdBy: 'Eric (AI)',
    changes: 'Added "priority" and "revenue" fields. Made "email" unique.',
    fieldCount: 8,
  },
  {
    id: 'v1',
    version: 1,
    createdAt: '2026-03-08 16:00',
    createdBy: 'admin@empresa.com.br',
    changes: 'Initial entity creation with basic fields.',
    fieldCount: 5,
  },
]

const meta: Meta<typeof EntityManagePanel> = {
  title: 'Organisms/EntityManagePanel',
  component: EntityManagePanel,
  tags: ['data'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onBack: { action: 'back' },
    onUpdateDescription: { action: 'update-description' },
    onAddField: { action: 'add-field' },
    onUpdateField: { action: 'update-field' },
    onDeleteField: { action: 'delete-field' },
  },
  args: {
    onBack: fn(),
    onUpdateDescription: fn(),
    onAddField: fn(),
    onUpdateField: fn(),
    onDeleteField: fn(),
  },
  decorators: [(Story) => <div style={{ height: '100vh' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof EntityManagePanel>

export const Default: Story = {
  args: {
    entityId: 'customers',
    entityName: 'Customers',
    entityDescription: 'Cadastro de clientes da empresa. Inclui dados de contato, classificação e histórico de compras.',
    fields: mockFields,
    relationships: mockRelationships,
    versions: mockVersions,
  },
}

export const EmptyEntity: Story = {
  name: 'Empty (no fields)',
  args: {
    entityId: 'new_entity',
    entityName: 'New Entity',
    entityDescription: '',
    fields: [],
    relationships: [],
    versions: [],
  },
}

export const FieldsOnly: Story = {
  name: 'Fields only (no relationships)',
  args: {
    entityId: 'products',
    entityName: 'Products',
    entityDescription: 'Catálogo de produtos disponíveis para venda.',
    fields: [
      { id: 'p1', name: 'sku', type: 'text', description: 'Código SKU do produto', required: true, unique: true },
      { id: 'p2', name: 'name', type: 'text', description: 'Nome do produto', required: true },
      { id: 'p3', name: 'price', type: 'currency', description: 'Preço unitário', currencyCode: 'BRL', required: true },
      { id: 'p4', name: 'quantity', type: 'number', description: 'Quantidade em estoque' },
      { id: 'p5', name: 'total_value', type: 'formula', description: 'Valor total em estoque', formula: '{price} * {quantity}' },
      { id: 'p6', name: 'category', type: 'select', description: 'Categoria do produto', options: [
        { value: 'electronics', label: 'Eletrônicos', color: '#3b82f6' },
        { value: 'clothing', label: 'Vestuário', color: '#8b5cf6' },
        { value: 'food', label: 'Alimentos', color: '#16a34a' },
      ]},
      { id: 'p7', name: 'active', type: 'checkbox', description: 'Produto ativo para venda' },
      { id: 'p8', name: 'rating', type: 'rating', description: 'Avaliação média dos clientes' },
      { id: 'p9', name: 'barcode', type: 'barcode', description: 'Código de barras EAN-13' },
      { id: 'p10', name: 'image', type: 'attachment', description: 'Foto principal do produto' },
    ],
    relationships: [],
    versions: [
      { id: 'v1', version: 1, createdAt: '2026-03-08 16:00', createdBy: 'admin@empresa.com.br', changes: 'Entidade criada com campos básicos de produto.', fieldCount: 10 },
    ],
  },
}

export const ManyRelationships: Story = {
  name: 'Rich relationships',
  args: {
    entityId: 'orders',
    entityName: 'Orders',
    entityDescription: 'Pedidos de venda. Cada pedido está vinculado a um cliente e contém itens de produto.',
    fields: [
      { id: 'o1', name: 'order_number', type: 'autonumber', description: 'Número sequencial do pedido', required: true },
      { id: 'o2', name: 'customer', type: 'relationship', description: 'Cliente vinculado', relationshipEntityId: 'customers', relationshipEntityName: 'Customers', required: true },
      { id: 'o3', name: 'date', type: 'date', description: 'Data do pedido', required: true },
      { id: 'o4', name: 'total', type: 'currency', description: 'Valor total', currencyCode: 'BRL' },
      { id: 'o5', name: 'status', type: 'status', options: [
        { value: 'pending', label: 'Pendente', color: '#d97706' },
        { value: 'approved', label: 'Aprovado', color: '#3b82f6' },
        { value: 'shipped', label: 'Enviado', color: '#8b5cf6' },
        { value: 'delivered', label: 'Entregue', color: '#16a34a' },
        { value: 'cancelled', label: 'Cancelado', color: '#dc2626' },
      ]},
      { id: 'o6', name: 'customer_name', type: 'lookup', description: 'Nome do cliente (lookup)', lookupFieldId: 'name', relationshipEntityName: 'Customers' },
      { id: 'o7', name: 'items_count', type: 'rollup', description: 'Quantidade de itens', rollupFunction: 'count', relationshipEntityName: 'Order Items' },
      { id: 'o8', name: 'created_at', type: 'created_at' },
      { id: 'o9', name: 'updated_at', type: 'updated_at' },
    ],
    relationships: [
      { id: 'r1', name: 'order_customer', type: 'one_to_many', sourceEntityId: 'customers', sourceEntityName: 'Customers', sourceFieldId: 'id', sourceFieldName: 'id', targetEntityId: 'orders', targetEntityName: 'Orders', targetFieldId: 'customer_id', targetFieldName: 'customer' },
      { id: 'r2', name: 'order_items', type: 'one_to_many', sourceEntityId: 'orders', sourceEntityName: 'Orders', sourceFieldId: 'id', sourceFieldName: 'id', targetEntityId: 'order_items', targetEntityName: 'Order Items', targetFieldId: 'order_id', targetFieldName: 'order_id' },
      { id: 'r3', name: 'order_invoice', type: 'one_to_one', sourceEntityId: 'orders', sourceEntityName: 'Orders', sourceFieldId: 'id', sourceFieldName: 'id', targetEntityId: 'invoices', targetEntityName: 'Invoices', targetFieldId: 'order_id', targetFieldName: 'order_id' },
      { id: 'r4', name: 'order_shipping', type: 'one_to_one', sourceEntityId: 'orders', sourceEntityName: 'Orders', sourceFieldId: 'id', sourceFieldName: 'id', targetEntityId: 'shipments', targetEntityName: 'Shipments', targetFieldId: 'order_id', targetFieldName: 'order_id' },
      { id: 'r5', name: 'order_payments', type: 'one_to_many', sourceEntityId: 'orders', sourceEntityName: 'Orders', sourceFieldId: 'id', sourceFieldName: 'id', targetEntityId: 'payments', targetEntityName: 'Payments', targetFieldId: 'order_id', targetFieldName: 'order_id' },
    ],
    versions: [
      { id: 'v2', version: 2, createdAt: '2026-03-11 10:00', createdBy: 'Eric (AI)', changes: 'Adicionados campos de lookup e rollup para integração com Order Items.', fieldCount: 9 },
      { id: 'v1', version: 1, createdAt: '2026-03-08 16:00', createdBy: 'admin@empresa.com.br', changes: 'Criação inicial com campos de pedido.', fieldCount: 6 },
    ],
  },
}
