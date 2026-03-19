import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { FileText, MessageSquare, Package, Star } from 'lucide-react'
import { SettingsScreen } from './SettingsScreen'

const mockUsers = [
  { id: 'u1', name: 'Ana Lima', email: 'ana@company.com', role: 'Administrator', status: 'active' as const },
  { id: 'u2', name: 'Carlos Mendes', email: 'carlos@company.com', role: 'Manager', status: 'active' as const },
  { id: 'u3', name: 'Diana Rocha', email: 'diana@company.com', role: 'Sales Rep', status: 'active' as const },
  { id: 'u4', name: 'Eduardo Faria', email: 'eduardo@company.com', role: 'Stock Clerk', status: 'pending' as const },
  { id: 'u5', name: 'Fernanda Costa', email: 'fernanda@company.com', role: 'Finance', status: 'active' as const },
  { id: 'u6', name: 'Gabriel Souza', email: 'gabriel@company.com', role: 'Support', status: 'inactive' as const },
]

const mockInstalledPlugins = [
  { name: 'NF-e Integration', description: 'Issue and query electronic invoices via SEFAZ', icon: <FileText size={20} />, installed: true, version: '2.1.4', category: 'Fiscal', rating: 4.8 },
  { name: 'WhatsApp Business', description: 'Send notifications and handle support via WhatsApp', icon: <MessageSquare size={20} />, installed: true, version: '1.3.0', category: 'Communication', rating: 4.5 },
]

const mockMarketplacePlugins = [
  { name: 'Mercado Livre', description: 'Sync products and orders with Mercado Livre', icon: <Package size={20} />, installed: false, category: 'E-commerce', rating: 4.9 },
  { name: 'Google Sheets', description: 'Export and sync data with Google Sheets', icon: <Star size={20} />, installed: false, category: 'Data', rating: 4.3 },
]

const mockCompanyInfo = {
  name: 'Example Company LLC',
  tradeName: 'RUN Corp',
  cnpj: '12.345.678/0001-90',
  address: '1000 Main Street - New York, NY',
  phone: '(555) 300-0000',
  email: 'contact@company.com',
  plan: 'RUN Enterprise',
  activeUsers: '6 / 50',
}

const mockAgents = [
  { id: 'a0', name: 'Eric', description: 'Your AI-powered ERP assistant. Eric helps manage tasks, query data, create entities, and automate workflows.', systemPrompt: 'You are Eric, the default AI assistant for RUN ERP.', modelId: '', skillIds: ['sk1', 'sk2'], toolIds: ['ct1', 'ct2'], skillCount: 2, toolCount: 2 },
  { id: 'a1', name: 'Agente de Vendas', description: 'Gerencia pedidos, clientes e propostas comerciais', systemPrompt: 'Voce e um assistente especializado em vendas.', modelId: 'gpt-4o', skillIds: ['sk1'], toolIds: ['ct1', 'ct2', 'ct3'], skillCount: 1, toolCount: 3 },
  { id: 'a2', name: 'Agente Financeiro', description: 'Contas a pagar, receber e conciliacao bancaria', systemPrompt: 'Voce e um assistente financeiro.', modelId: '', skillIds: ['sk2'], toolIds: ['ct3'], skillCount: 1, toolCount: 1 },
]

const mockSkills = [
  { id: 'sk1', name: 'Gestao de Pedidos', description: 'Cria, consulta e atualiza pedidos', toolCount: 4, hasGuardrails: true },
  { id: 'sk2', name: 'Consulta de Estoque', description: 'Consulta saldos e movimentacoes de estoque', toolCount: 2, hasGuardrails: false },
]

const mockCustomTools = [
  { id: 'ct1', name: 'buscar_pedido', description: 'Busca pedido por ID no sistema de vendas', type: 'http' as const },
  { id: 'ct2', name: 'calcular_frete', description: 'Calcula frete com base no CEP e peso', type: 'code' as const },
  { id: 'ct3', name: 'relatorio_vendas', description: 'Gera relatorio de vendas do periodo', type: 'query' as const },
  { id: 'ct4', name: 'enviar_whatsapp', description: 'Envia mensagem via WhatsApp Business API', type: 'http' as const, integrationName: 'WhatsApp Business' },
]

const mockIntegrations = [
  { id: 'int1', name: 'SEFAZ NF-e', description: 'Emissao e consulta de notas fiscais eletronicas', type: 'rest' as const, enabled: true },
  { id: 'int2', name: 'Google Sheets', description: 'Sincronizacao de dados com planilhas Google', type: 'oauth2' as const, enabled: false },
  { id: 'int3', name: 'Mercado Livre', description: 'Recebe notificacoes de novos pedidos', type: 'webhook' as const, enabled: true },
]

const skillOptions = [
  { value: 'sk1', label: 'Gestao de Pedidos' },
  { value: 'sk2', label: 'Consulta de Estoque' },
]

const toolOptions = [
  { value: 'ct1', label: 'buscar_pedido' },
  { value: 'ct2', label: 'calcular_frete' },
  { value: 'ct3', label: 'relatorio_vendas' },
  { value: 'ct4', label: 'enviar_whatsapp' },
]

const systemToolOptions = [
  { value: 'createEntity', label: 'createEntity' },
  { value: 'queryEntities', label: 'queryEntities' },
  { value: 'updateEntity', label: 'updateEntity' },
]

const integrationOptions = [
  { value: 'int1', label: 'SEFAZ NF-e' },
  { value: 'int3', label: 'Mercado Livre' },
]

const meta: Meta<typeof SettingsScreen> = {
  title: 'Screens/SettingsScreen',
  component: SettingsScreen,
  tags: ['settings'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    activeSection: { control: 'select', options: ['users', 'plugins', 'permissions', 'company', 'agents', 'skills', 'tools', 'integrations'] },
    onSectionChange: { action: 'section-changed' },
    onEditUser: { action: 'edit-user' },
    onInviteUser: { action: 'invite-user' },
    onInstallPlugin: { action: 'install-plugin' },
    onConfigurePlugin: { action: 'configure-plugin' },
    onUninstallPlugin: { action: 'uninstall-plugin' },
    onSaveCompany: { action: 'save-company' },
  },
  args: {
    onSectionChange: fn(),
    onEditUser: fn(),
    onInviteUser: fn(),
    onInstallPlugin: fn(),
    onConfigurePlugin: fn(),
    onUninstallPlugin: fn(),
    onSaveCompany: fn(),
    onCreateAgent: fn(),
    onUpdateAgent: fn(),
    onDeleteAgent: fn(),
    onCreateSkill: fn(),
    onUpdateSkill: fn(),
    onDeleteSkill: fn(),
    onCreateTool: fn(),
    onUpdateTool: fn(),
    onDeleteTool: fn(),
    onTestTool: fn(),
    onCreateIntegration: fn(),
    onUpdateIntegration: fn(),
    onDeleteIntegration: fn(),
    onToggleIntegration: fn(),
    onOAuthConnect: fn(),
    skillOptions,
    toolOptions,
    systemToolOptions,
    integrationOptions,
  },
  decorators: [(Story) => <div style={{ height: '100vh' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof SettingsScreen>

export const Default: Story = {
  args: {
    users: mockUsers,
    installedPlugins: mockInstalledPlugins,
    marketplacePlugins: mockMarketplacePlugins,
    companyInfo: mockCompanyInfo,
    agents: mockAgents,
    skills: mockSkills,
    skillOptions: mockSkills.map(s => ({ value: s.id, label: s.name })),
    toolOptions: mockCustomTools.map(t => ({ value: t.id, label: t.name })),
    customTools: mockCustomTools,
    integrations: mockIntegrations,
  },
}

export const Users: Story = {
  args: { ...Default.args, activeSection: 'users' },
}

export const Agents: Story = {
  args: { ...Default.args, activeSection: 'agents' },
}

export const Skills: Story = {
  args: { ...Default.args, activeSection: 'skills' },
}

export const CustomTools: Story = {
  args: { ...Default.args, activeSection: 'tools' },
}

export const Integrations: Story = {
  args: { ...Default.args, activeSection: 'integrations' },
}

export const Plugins: Story = {
  args: { ...Default.args, activeSection: 'plugins' },
}

export const Permissions: Story = {
  args: { ...Default.args, activeSection: 'permissions' },
}

export const Company: Story = {
  args: { ...Default.args, activeSection: 'company' },
}

export const WithEmptyPlugins: Story = {
  args: { ...Default.args, installedPlugins: [], marketplacePlugins: [], activeSection: 'plugins' },
}
