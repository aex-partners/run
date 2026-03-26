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

export const AllFieldTypes: Story = {
  name: 'All field types',
  args: {
    entityId: 'projects',
    entityName: 'Projects',
    entityDescription: 'Gestão completa de projetos com todos os tipos de campo disponíveis no sistema.',
    fields: [
      { id: 'af1', name: 'name', type: 'text', description: 'Nome do projeto', required: true, unique: true },
      { id: 'af2', name: 'description', type: 'long_text', description: 'Descrição detalhada do projeto' },
      { id: 'af3', name: 'team_size', type: 'number', description: 'Quantidade de membros na equipe' },
      { id: 'af4', name: 'completion_rate', type: 'decimal', description: 'Taxa de conclusão', decimalPlaces: 2 },
      { id: 'af5', name: 'budget', type: 'currency', description: 'Orçamento total do projeto', currencyCode: 'BRL', required: true },
      { id: 'af6', name: 'profit_margin', type: 'percent', description: 'Margem de lucro prevista' },
      { id: 'af7', name: 'start_date', type: 'date', description: 'Data de início do projeto', required: true },
      { id: 'af8', name: 'kickoff_at', type: 'datetime', description: 'Data e hora da reunião de kickoff' },
      { id: 'af9', name: 'estimated_hours', type: 'duration', description: 'Horas estimadas para conclusão' },
      { id: 'af10', name: 'billable', type: 'checkbox', description: 'Projeto faturável' },
      {
        id: 'af11', name: 'category', type: 'select', description: 'Categoria do projeto',
        options: [
          { value: 'development', label: 'Desenvolvimento', color: '#3b82f6' },
          { value: 'design', label: 'Design', color: '#8b5cf6' },
          { value: 'marketing', label: 'Marketing', color: '#ec4899' },
          { value: 'consulting', label: 'Consultoria', color: '#f59e0b' },
        ],
      },
      {
        id: 'af12', name: 'tags', type: 'multiselect', description: 'Tags do projeto',
        options: [
          { value: 'urgent', label: 'Urgente', color: '#dc2626' },
          { value: 'strategic', label: 'Estratégico', color: '#7c3aed' },
          { value: 'internal', label: 'Interno', color: '#6b7280' },
          { value: 'client', label: 'Cliente', color: '#0891b2' },
        ],
      },
      {
        id: 'af13', name: 'status', type: 'status', description: 'Status atual do projeto',
        options: [
          { value: 'planning', label: 'Planejamento', color: '#6b7280' },
          { value: 'in_progress', label: 'Em Andamento', color: '#3b82f6' },
          { value: 'review', label: 'Revisão', color: '#d97706' },
          { value: 'completed', label: 'Concluído', color: '#16a34a' },
          { value: 'cancelled', label: 'Cancelado', color: '#dc2626' },
        ],
      },
      {
        id: 'af14', name: 'priority', type: 'priority', description: 'Prioridade do projeto',
        options: [
          { value: 'critical', label: 'Crítica', color: '#dc2626' },
          { value: 'high', label: 'Alta', color: '#f97316' },
          { value: 'medium', label: 'Média', color: '#d97706' },
          { value: 'low', label: 'Baixa', color: '#16a34a' },
        ],
      },
      { id: 'af15', name: 'satisfaction', type: 'rating', description: 'Satisfação do cliente', maxRating: 5 },
      { id: 'af16', name: 'contact_email', type: 'email', description: 'Email do responsável' },
      { id: 'af17', name: 'repository', type: 'url', description: 'URL do repositório' },
      { id: 'af18', name: 'contact_phone', type: 'phone', description: 'Telefone do responsável' },
      { id: 'af19', name: 'owner', type: 'person', description: 'Responsável pelo projeto' },
      { id: 'af20', name: 'client', type: 'relationship', description: 'Cliente vinculado', relationshipEntityId: 'clients', relationshipEntityName: 'Clients', required: true },
      { id: 'af21', name: 'client_name', type: 'lookup', description: 'Nome do cliente (lookup)', lookupFieldId: 'name', relationshipEntityName: 'Clients' },
      { id: 'af22', name: 'total_tasks', type: 'rollup', description: 'Total de tarefas do projeto', rollupFunction: 'count', relationshipEntityName: 'Tasks' },
      { id: 'af23', name: 'health_score', type: 'formula', description: 'Score de saúde calculado', formula: 'IF({completion_rate} > 0.8, "green", IF({completion_rate} > 0.5, "yellow", "red"))' },
      { id: 'af24', name: 'project_number', type: 'autonumber', description: 'Número sequencial do projeto' },
      { id: 'af25', name: 'files', type: 'attachment', description: 'Documentos e arquivos do projeto' },
      { id: 'af26', name: 'metadata', type: 'json', description: 'Metadados do projeto em JSON' },
      { id: 'af27', name: 'tracking_code', type: 'barcode', description: 'Código de rastreamento' },
      { id: 'af28', name: 'ai_summary', type: 'ai', description: 'Resumo gerado por IA', aiPrompt: 'Resuma o projeto {name} considerando o status {status} e a taxa de conclusão {completion_rate}' },
      { id: 'af29', name: 'created_at', type: 'created_at', description: 'Data de criação do registro' },
      { id: 'af30', name: 'updated_at', type: 'updated_at', description: 'Última atualização do registro' },
      { id: 'af31', name: 'created_by', type: 'created_by', description: 'Usuário que criou o registro' },
      { id: 'af32', name: 'updated_by', type: 'updated_by', description: 'Usuário da última atualização' },
    ],
    relationships: [
      { id: 'ar1', name: 'project_client', type: 'one_to_many' as const, sourceEntityId: 'clients', sourceEntityName: 'Clients', sourceFieldId: 'id', sourceFieldName: 'id', targetEntityId: 'projects', targetEntityName: 'Projects', targetFieldId: 'client_id', targetFieldName: 'client' },
      { id: 'ar2', name: 'project_tasks', type: 'one_to_many' as const, sourceEntityId: 'projects', sourceEntityName: 'Projects', sourceFieldId: 'id', sourceFieldName: 'id', targetEntityId: 'tasks', targetEntityName: 'Tasks', targetFieldId: 'project_id', targetFieldName: 'project_id' },
      { id: 'ar3', name: 'project_members', type: 'many_to_many' as const, sourceEntityId: 'projects', sourceEntityName: 'Projects', sourceFieldId: 'id', sourceFieldName: 'id', targetEntityId: 'users', targetEntityName: 'Users' },
    ],
    versions: [
      { id: 'av3', version: 3, createdAt: '2026-03-20 11:00', createdBy: 'Eric (AI)', changes: 'Adicionados campos de AI, barcode, JSON e system fields.', fieldCount: 32 },
      { id: 'av2', version: 2, createdAt: '2026-03-15 09:30', createdBy: 'Eric (AI)', changes: 'Adicionados campos relacionais (lookup, rollup, formula) e campos de seleção com opções coloridas.', fieldCount: 24 },
      { id: 'av1', version: 1, createdAt: '2026-03-10 14:00', createdBy: 'admin@empresa.com.br', changes: 'Criação inicial da entidade Projects com campos básicos.', fieldCount: 12 },
    ],
  },
}
