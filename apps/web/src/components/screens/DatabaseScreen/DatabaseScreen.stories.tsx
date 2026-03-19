import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Users, Package, Tag } from 'lucide-react'
import { DatabaseScreen } from './DatabaseScreen'
import type { EntityField, EntityRelationship, EntityVersion } from '../../organisms/EntityManagePanel/EntityManagePanel'

const mockEntities = [
  { id: 'customers', name: 'Customers', count: 248, icon: <Users size={14} /> },
  { id: 'orders', name: 'Sales Orders', count: 1842, icon: <Package size={14} /> },
  { id: 'products', name: 'Products', count: 512, icon: <Tag size={14} /> },
]

const mockColumns = [
  { id: 'id', label: 'ID', type: 'text' as const, width: 80 },
  { id: 'name', label: 'Name', type: 'text' as const, width: 200 },
  { id: 'city', label: 'City', type: 'text' as const, width: 140 },
  { id: 'status', label: 'Status', type: 'badge' as const, width: 120 },
  { id: 'orders', label: 'Orders', type: 'number' as const, width: 100 },
  { id: 'total', label: 'Total ($)', type: 'number' as const, width: 120 },
]

const mockRows = [
  { id: 'CLI-001', name: 'Acme Distributors', city: 'New York', status: 'Active', orders: 42, total: 184500 },
  { id: 'CLI-002', name: 'Beta Commerce', city: 'Los Angeles', status: 'Active', orders: 18, total: 67200 },
  { id: 'CLI-003', name: 'Gamma Tech', city: 'Chicago', status: 'Inactive', orders: 5, total: 12300 },
  { id: 'CLI-004', name: 'Delta Industries', city: 'Houston', status: 'Active', orders: 31, total: 95800 },
  { id: 'CLI-005', name: 'Epsilon Logistics', city: 'Miami', status: 'Pending', orders: 0, total: 0 },
]

const mockRowsByEntity = {
  customers: [
    { id: 'CLI-001', name: 'Acme Distributors', city: 'New York', status: 'Active', orders: 42, total: 184500 },
    { id: 'CLI-002', name: 'Beta Commerce', city: 'Los Angeles', status: 'Active', orders: 18, total: 67200 },
    { id: 'CLI-003', name: 'Gamma Tech', city: 'Chicago', status: 'Inactive', orders: 5, total: 12300 },
    { id: 'CLI-004', name: 'Delta Industries', city: 'Houston', status: 'Active', orders: 31, total: 95800 },
    { id: 'CLI-005', name: 'Epsilon Logistics', city: 'Miami', status: 'Pending', orders: 0, total: 0 },
  ],
  orders: [
    { id: 'ORD-1001', name: 'Order #1001', city: 'New York', status: 'Shipped', orders: 1, total: 4350 },
    { id: 'ORD-1002', name: 'Order #1002', city: 'Chicago', status: 'Processing', orders: 1, total: 1280 },
    { id: 'ORD-1003', name: 'Order #1003', city: 'Miami', status: 'Pending', orders: 1, total: 870 },
    { id: 'ORD-1004', name: 'Order #1004', city: 'Houston', status: 'Delivered', orders: 1, total: 6100 },
  ],
  products: [
    { id: 'PRD-001', name: 'Widget A', city: 'Warehouse 1', status: 'Active', orders: 340, total: 17000 },
    { id: 'PRD-002', name: 'Gadget B', city: 'Warehouse 2', status: 'Active', orders: 210, total: 42000 },
    { id: 'PRD-003', name: 'Component C', city: 'Warehouse 1', status: 'Inactive', orders: 0, total: 0 },
  ],
}

const mockEntityFields: Record<string, EntityField[]> = {
  customers: [
    { id: 'f1', name: 'name', type: 'text', description: 'Nome completo do cliente', required: true },
    { id: 'f2', name: 'email', type: 'email', description: 'Email principal', required: true, unique: true },
    { id: 'f3', name: 'city', type: 'text', description: 'Cidade' },
    { id: 'f4', name: 'status', type: 'status', description: 'Status do cadastro', required: true, options: [
      { value: 'active', label: 'Ativo', color: '#16a34a' },
      { value: 'inactive', label: 'Inativo', color: '#dc2626' },
      { value: 'pending', label: 'Pendente', color: '#d97706' },
    ]},
    { id: 'f5', name: 'orders', type: 'rollup', description: 'Total de pedidos', rollupFunction: 'count', relationshipEntityName: 'Sales Orders' },
    { id: 'f6', name: 'total', type: 'currency', description: 'Receita total', currencyCode: 'USD' },
    { id: 'f7', name: 'created_at', type: 'created_at' },
  ],
  orders: [
    { id: 'o1', name: 'order_id', type: 'autonumber', description: 'Número do pedido' },
    { id: 'o2', name: 'customer', type: 'relationship', description: 'Cliente', relationshipEntityName: 'Customers', required: true },
    { id: 'o3', name: 'status', type: 'status', options: [
      { value: 'shipped', label: 'Enviado', color: '#3b82f6' },
      { value: 'processing', label: 'Processando', color: '#d97706' },
      { value: 'pending', label: 'Pendente', color: '#6b7280' },
      { value: 'delivered', label: 'Entregue', color: '#16a34a' },
    ]},
    { id: 'o4', name: 'total', type: 'currency', currencyCode: 'USD' },
  ],
  products: [
    { id: 'p1', name: 'sku', type: 'text', required: true, unique: true },
    { id: 'p2', name: 'name', type: 'text', required: true },
    { id: 'p3', name: 'stock', type: 'number' },
    { id: 'p4', name: 'price', type: 'currency', currencyCode: 'USD' },
    { id: 'p5', name: 'total_value', type: 'formula', formula: '{price} * {stock}' },
  ],
}

const mockEntityRelationships: Record<string, EntityRelationship[]> = {
  customers: [
    { id: 'r1', name: 'customer_orders', type: 'one_to_many', sourceEntityId: 'customers', sourceEntityName: 'Customers', sourceFieldId: 'f1', sourceFieldName: 'id', targetEntityId: 'orders', targetEntityName: 'Sales Orders', targetFieldId: 'customer_id', targetFieldName: 'customer' },
  ],
  orders: [
    { id: 'r1', name: 'order_customer', type: 'one_to_many', sourceEntityId: 'customers', sourceEntityName: 'Customers', sourceFieldId: 'id', sourceFieldName: 'id', targetEntityId: 'orders', targetEntityName: 'Sales Orders', targetFieldId: 'customer_id', targetFieldName: 'customer' },
  ],
}

const mockEntityVersions: Record<string, EntityVersion[]> = {
  customers: [
    { id: 'v2', version: 2, createdAt: '2026-03-12 14:30', createdBy: 'Eric (AI)', changes: 'Added rollup field for total orders.', fieldCount: 7 },
    { id: 'v1', version: 1, createdAt: '2026-03-08 16:00', createdBy: 'admin@company.com', changes: 'Initial entity creation.', fieldCount: 5 },
  ],
}

const mockEntityDescriptions: Record<string, string> = {
  customers: 'Cadastro de clientes. Contém dados de contato e histórico de compras.',
  orders: 'Pedidos de venda vinculados a clientes.',
  products: 'Catálogo de produtos disponíveis.',
}

const meta: Meta<typeof DatabaseScreen> = {
  title: 'Screens/DatabaseScreen',
  component: DatabaseScreen,
  tags: ['data'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onEntitySelect: { action: 'entity-selected' },
    onNewEntity: { action: 'new-entity' },
    onAddRow: { action: 'add-row' },
    onAddColumn: { action: 'add-column' },
    onSelectRow: { action: 'select-row' },
    onAISend: { action: 'ai-sent' },
    onRenameEntity: { action: 'entity-renamed' },
    onDeleteEntity: { action: 'entity-deleted' },
    onManageEntity: { action: 'manage-entity' },
    onViewLogs: { action: 'view-logs' },
    onUpdateEntityDescription: { action: 'update-entity-description' },
    onAddEntityField: { action: 'add-entity-field' },
    onUpdateEntityField: { action: 'update-entity-field' },
    onDeleteEntityField: { action: 'delete-entity-field' },
  },
  args: {
    onEntitySelect: fn(),
    onNewEntity: fn(),
    onAddRow: fn(),
    onAddColumn: fn(),
    onSelectRow: fn(),
    onAISend: fn(),
    onRenameEntity: fn(),
    onDeleteEntity: fn(),
    onManageEntity: fn(),
    onViewLogs: fn(),
    onUpdateEntityDescription: fn(),
    onAddEntityField: fn(),
    onUpdateEntityField: fn(),
    onDeleteEntityField: fn(),
  },
  decorators: [(Story) => <div style={{ height: '100vh' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof DatabaseScreen>

export const Default: Story = {
  args: {
    entities: mockEntities,
    activeEntityId: 'customers',
    columns: mockColumns,
    rows: mockRows,
    rowsByEntity: mockRowsByEntity,
    entityManageFields: mockEntityFields,
    entityManageRelationships: mockEntityRelationships,
    entityManageVersions: mockEntityVersions,
    entityDescriptions: mockEntityDescriptions,
  },
}

export const Empty: Story = {
  args: {
    entities: mockEntities,
    activeEntityId: 'customers',
    columns: mockColumns,
    rows: [],
  },
}

/** Double-click an entity name to rename it inline. Hover an entity and click the trash icon to delete it. */
export const EntityRenameDelete: Story = {
  name: 'Rename / Delete entity',
  args: {
    entities: mockEntities,
    activeEntityId: 'orders',
    columns: mockColumns,
    rows: mockRows,
    rowsByEntity: mockRowsByEntity,
  },
}

export const WithSelectedRows: Story = {
  args: {
    entities: mockEntities,
    activeEntityId: 'customers',
    columns: mockColumns,
    rows: mockRows,
    rowsByEntity: mockRowsByEntity,
    selectedRows: ['CLI-001', 'CLI-002'],
  },
}

export const EmptyRows: Story = {
  args: {
    entities: mockEntities,
    activeEntityId: 'customers',
    columns: mockColumns,
    rows: [],
  },
}
