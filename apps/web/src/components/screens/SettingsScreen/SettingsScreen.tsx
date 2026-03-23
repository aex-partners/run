import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Puzzle, Shield, Building2, ChevronRight, Bot, Sparkles, Wrench, Plug, Plus, Search } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { UserTable, type User } from '../../organisms/UserTable/UserTable'
import { PluginCard, type PluginCardProps } from '../../molecules/PluginCard/PluginCard'
import { AgentCard, type AgentCardProps } from '../../molecules/AgentCard/AgentCard'
import { SkillCard, type SkillCardProps } from '../../molecules/SkillCard/SkillCard'
import { CustomToolCard, type CustomToolCardProps } from '../../molecules/CustomToolCard/CustomToolCard'
import { IntegrationCard, type IntegrationCardProps } from '../../molecules/IntegrationCard/IntegrationCard'
import { AgentForm, type AgentFormData } from '../../organisms/AgentForm/AgentForm'
import { SkillForm, type SkillFormData } from '../../organisms/SkillForm/SkillForm'
import { CustomToolForm, type CustomToolFormData, type TestResult } from '../../organisms/CustomToolForm/CustomToolForm'
import { IntegrationForm, type IntegrationFormData } from '../../organisms/IntegrationForm/IntegrationForm'
import { Button } from '../../atoms/Button/Button'
// PluginConfigDialog replaced by PluginConnectDialog (rendered in SettingsPage)
import type { MultiSelectOption } from '../../molecules/MultiSelect/MultiSelect'

export type SettingsSection = 'users' | 'plugins' | 'permissions' | 'company' | 'agents' | 'skills' | 'tools' | 'integrations'

export interface CompanyInfo {
  name: string
  tradeName: string
  cnpj: string
  address: string
  phone: string
  email: string
  plan: string
  activeUsers: string
}

// Agent data from server
export interface AgentData {
  id: string
  name: string
  description?: string
  avatar?: string
  systemPrompt?: string
  modelId?: string
  skillIds?: string[]
  toolIds?: string[]
  skillCount?: number
  toolCount?: number
}

// Skill data from server
export interface SkillData {
  id: string
  name: string
  description?: string
  toolCount?: number
  hasGuardrails?: boolean
}

// CustomTool data from server
export interface CustomToolData {
  id: string
  name: string
  description?: string
  type: 'http' | 'query' | 'code' | 'composite'
  integrationName?: string
}

// Piece tool data (actions from installed piece plugins)
export interface PieceToolData {
  name: string
  displayName: string
  description: string
  pluginName: string
  pluginLogoUrl?: string
}

// Integration data from server
export interface IntegrationData {
  id: string
  name: string
  description?: string
  type: 'rest' | 'oauth2' | 'webhook'
  enabled?: boolean
}

export interface SettingsScreenProps {
  users: User[]
  installedPlugins: Omit<PluginCardProps, 'onInstall' | 'onConfigure' | 'onUninstall' | 'onToggle'>[]
  marketplacePlugins: Omit<PluginCardProps, 'onInstall' | 'onConfigure' | 'onUninstall' | 'onToggle'>[]
  companyInfo?: CompanyInfo
  activeSection?: SettingsSection
  onSectionChange?: (section: SettingsSection) => void
  onEditUser?: (userId: string) => void
  onDeleteUser?: (userId: string) => void
  onChangeRole?: (userId: string, role: string) => void
  onChangeStatus?: (userId: string, status: string) => void
  onInviteUser?: () => void
  onInstallPlugin?: (name: string) => void
  onConfigurePlugin?: (name: string) => void
  onUninstallPlugin?: (name: string) => void
  onTogglePlugin?: (name: string, enabled: boolean) => void
  onSyncPluginRegistry?: () => void
  syncingPlugins?: boolean
  onSaveCompany?: (info: CompanyInfo) => void

  // Agents
  agents?: AgentData[]
  skillOptions?: MultiSelectOption[]
  toolOptions?: MultiSelectOption[]
  onCreateAgent?: (data: AgentFormData) => void
  onUpdateAgent?: (id: string, data: AgentFormData) => void
  onDeleteAgent?: (id: string) => void

  // Skills
  skills?: SkillData[]
  systemToolOptions?: MultiSelectOption[]
  onCreateSkill?: (data: SkillFormData) => void
  onUpdateSkill?: (id: string, data: SkillFormData) => void
  onDeleteSkill?: (id: string) => void

  // Tools
  customTools?: CustomToolData[]
  pieceTools?: PieceToolData[]
  integrationOptions?: { value: string; label: string }[]
  onCreateTool?: (data: CustomToolFormData) => void
  onUpdateTool?: (id: string, data: CustomToolFormData) => void
  onDeleteTool?: (id: string) => void
  onTestTool?: (data: CustomToolFormData) => void
  testResult?: TestResult | null

  // Integrations
  integrations?: IntegrationData[]
  onCreateIntegration?: (data: IntegrationFormData) => void
  onUpdateIntegration?: (id: string, data: IntegrationFormData) => void
  onDeleteIntegration?: (id: string) => void
  onToggleIntegration?: (id: string, enabled: boolean) => void
  onOAuthConnect?: (type: string) => void

  // Form loading state
  formLoading?: boolean
}

const ROLES = ['Administrator', 'Manager', 'Sales Rep', 'Stock Clerk', 'Finance', 'Support'] as const
type Role = typeof ROLES[number]

const PERMISSIONS = [
  'View Orders',
  'Edit Orders',
  'View Stock',
  'Edit Stock',
  'View Finance',
  'Manage Users',
  'Manage Plugins',
] as const
type Permission = typeof PERMISSIONS[number]

type PermissionMatrix = Record<Role, Record<Permission, boolean>>

const defaultPermissions: PermissionMatrix = {
  Administrator: {
    'View Orders': true, 'Edit Orders': true, 'View Stock': true, 'Edit Stock': true,
    'View Finance': true, 'Manage Users': true, 'Manage Plugins': true,
  },
  Manager: {
    'View Orders': true, 'Edit Orders': true, 'View Stock': true, 'Edit Stock': false,
    'View Finance': true, 'Manage Users': false, 'Manage Plugins': false,
  },
  'Sales Rep': {
    'View Orders': true, 'Edit Orders': true, 'View Stock': true, 'Edit Stock': false,
    'View Finance': false, 'Manage Users': false, 'Manage Plugins': false,
  },
  'Stock Clerk': {
    'View Orders': true, 'Edit Orders': false, 'View Stock': true, 'Edit Stock': true,
    'View Finance': false, 'Manage Users': false, 'Manage Plugins': false,
  },
  Finance: {
    'View Orders': true, 'Edit Orders': false, 'View Stock': false, 'Edit Stock': false,
    'View Finance': true, 'Manage Users': false, 'Manage Plugins': false,
  },
  Support: {
    'View Orders': true, 'Edit Orders': false, 'View Stock': false, 'Edit Stock': false,
    'View Finance': false, 'Manage Users': false, 'Manage Plugins': false,
  },
}

const COMPANY_FIELD_LABELS: Record<keyof CompanyInfo, string> = {
  name: 'Legal Name', tradeName: 'Trade Name', cnpj: 'Tax ID', address: 'Address',
  phone: 'Phone', email: 'E-mail', plan: 'Plan', activeUsers: 'Active Users',
}

const READ_ONLY_FIELDS: (keyof CompanyInfo)[] = ['cnpj', 'plan', 'activeUsers']

const navItems: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: 'users', label: 'Users', icon: <Users size={15} /> },
  { id: 'agents', label: 'Agents', icon: <Bot size={15} /> },
  { id: 'skills', label: 'Skills', icon: <Sparkles size={15} /> },
  { id: 'tools', label: 'Tools', icon: <Wrench size={15} /> },
  { id: 'plugins', label: 'Plugins', icon: <Puzzle size={15} /> },
  { id: 'integrations', label: 'Integrations', icon: <Plug size={15} /> },
  { id: 'permissions', label: 'Permissions', icon: <Shield size={15} /> },
  { id: 'company', label: 'Company', icon: <Building2 size={15} /> },
]

// Dialog wrapper
function FormDialog({ open, onClose, title, closeLabel, children }: { open: boolean; onClose: () => void; title: string; closeLabel: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
        <Dialog.Content
          style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 520, maxHeight: '90vh', overflow: 'auto',
            background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 24, zIndex: 201,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Dialog.Title style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label={closeLabel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Section header with "New" button
function SectionHeader({ title, subtitle, onNew, newLabel }: { title: string; subtitle?: string; onNew?: () => void; newLabel: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {onNew && (
        <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} onClick={onNew}>{newLabel}</Button>
      )}
    </div>
  )
}

export function SettingsScreen(props: SettingsScreenProps) {
  const { t } = useTranslation()
  const {
    users, installedPlugins, marketplacePlugins, companyInfo,
    activeSection: controlledSection, onSectionChange, onEditUser, onDeleteUser, onChangeRole, onChangeStatus, onInviteUser,
    onInstallPlugin, onConfigurePlugin, onUninstallPlugin, onTogglePlugin, onSyncPluginRegistry, syncingPlugins,
    onSaveCompany,
    agents = [], skillOptions = [], toolOptions = [], onCreateAgent, onUpdateAgent, onDeleteAgent,
    skills = [], systemToolOptions = [], onCreateSkill, onUpdateSkill, onDeleteSkill,
    customTools = [], pieceTools = [], integrationOptions = [], onCreateTool, onUpdateTool, onDeleteTool, onTestTool, testResult,
    integrations = [], onCreateIntegration, onUpdateIntegration, onDeleteIntegration, onToggleIntegration, onOAuthConnect,
    formLoading = false,
  } = props

  const [internalSection, setInternalSection] = useState<SettingsSection>('users')
  const activeSection = controlledSection ?? internalSection

  // Dialog states
  const [dialogType, setDialogType] = useState<'agent' | 'skill' | 'tool' | 'integration' | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  // Plugins local state
  const [localInstalled, setLocalInstalled] = useState(installedPlugins)
  const [localMarketplace, setLocalMarketplace] = useState(marketplacePlugins)

  React.useEffect(() => { setLocalInstalled(installedPlugins) }, [installedPlugins])
  React.useEffect(() => { setLocalMarketplace(marketplacePlugins) }, [marketplacePlugins])

  // Marketplace search and filter
  const [pluginSearch, setPluginSearch] = useState('')
  const [pluginCategory, setPluginCategory] = useState<string>('all')
  const PLUGIN_CATEGORIES = [
    { value: 'all', label: 'All' },
    { value: 'ARTIFICIAL_INTELLIGENCE', label: 'AI' },
    { value: 'COMMUNICATION', label: 'Communication' },
    { value: 'PRODUCTIVITY', label: 'Productivity' },
    { value: 'DEVELOPER_TOOLS', label: 'Dev Tools' },
    { value: 'SALES_AND_CRM', label: 'Sales & CRM' },
    { value: 'COMMERCE', label: 'Commerce' },
    { value: 'PAYMENT_PROCESSING', label: 'Payments' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'CONTENT_AND_FILES', label: 'Content & Files' },
    { value: 'CUSTOMER_SUPPORT', label: 'Support' },
    { value: 'FORMS_AND_SURVEYS', label: 'Forms' },
    { value: 'BUSINESS_INTELLIGENCE', label: 'Analytics' },
    { value: 'ACCOUNTING', label: 'Accounting' },
    { value: 'HUMAN_RESOURCES', label: 'HR' },
  ]

  const filteredMarketplace = useMemo(() => {
    let result = localMarketplace
    if (pluginSearch) {
      const q = pluginSearch.toLowerCase()
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
      )
    }
    if (pluginCategory !== 'all') {
      result = result.filter((p) => p.category === pluginCategory)
    }
    return result
  }, [localMarketplace, pluginSearch, pluginCategory])

  const MARKETPLACE_PAGE_SIZE = 50
  const [marketplacePage, setMarketplacePage] = useState(1)
  const visibleMarketplace = filteredMarketplace.slice(0, marketplacePage * MARKETPLACE_PAGE_SIZE)
  const hasMoreMarketplace = visibleMarketplace.length < filteredMarketplace.length

  // Reset page when filter changes
  React.useEffect(() => { setMarketplacePage(1) }, [pluginSearch, pluginCategory])

  // Plugin tab state
  const [pluginTab, setPluginTab] = useState<'installed' | 'marketplace'>('installed')

  // Tools filter
  const [toolFilter, setToolFilter] = useState<string>('all')
  const [toolSearch, setToolSearch] = useState('')

  const pieceToolPlugins = useMemo(() => {
    const names = new Set(pieceTools.map((t) => t.pluginName))
    return Array.from(names).sort()
  }, [pieceTools])

  const filteredPieceTools = useMemo(() => {
    let result = pieceTools
    if (toolFilter !== 'all') {
      result = result.filter((t) => t.pluginName === toolFilter)
    }
    if (toolSearch) {
      const q = toolSearch.toLowerCase()
      result = result.filter((t) => t.displayName.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    }
    return result
  }, [pieceTools, toolFilter, toolSearch])

  const handleInstall = (name: string) => {
    const plugin = localMarketplace.find((p) => p.name === name)
    if (plugin) {
      setLocalInstalled((prev) => [...prev, { ...plugin, installed: true, installing: true }])
      setLocalMarketplace((prev) => prev.filter((p) => p.name !== name))
      // Switch to installed tab to show progress
      setPluginTab('installed')
    }
    onInstallPlugin?.(name)
  }

  const handleUninstall = (name: string) => {
    const plugin = localInstalled.find((p) => p.name === name)
    if (plugin) {
      setLocalInstalled((prev) => prev.filter((p) => p.name !== name))
      setLocalMarketplace((prev) => [...prev, { ...plugin, installed: false }])
    }
    onUninstallPlugin?.(name)
  }

  // Permissions state
  const [permissions, setPermissions] = useState<PermissionMatrix>(defaultPermissions)

  // Company info state
  const [localCompany, setLocalCompany] = useState<CompanyInfo>(
    companyInfo ?? { name: '', tradeName: '', cnpj: '', address: '', phone: '', email: '', plan: '', activeUsers: '' }
  )
  const [editingField, setEditingField] = useState<keyof CompanyInfo | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')

  React.useEffect(() => { if (companyInfo) setLocalCompany(companyInfo) }, [companyInfo])

  const handleSection = (section: SettingsSection) => {
    setInternalSection(section)
    onSectionChange?.(section)
  }

  const handlePermissionChange = (role: Role, permission: Permission, checked: boolean) => {
    setPermissions((prev) => ({ ...prev, [role]: { ...prev[role], [permission]: checked } }))
  }

  const startEditField = (field: keyof CompanyInfo) => {
    if (READ_ONLY_FIELDS.includes(field)) return
    setEditingField(field)
    setEditingValue(localCompany[field])
  }

  const commitField = () => {
    if (editingField) {
      setLocalCompany((prev) => ({ ...prev, [editingField]: editingValue }))
      setEditingField(null)
    }
  }

  const handleSaveCompany = () => {
    if (editingField) {
      setLocalCompany((prev) => {
        const updated = { ...prev, [editingField]: editingValue }
        onSaveCompany?.(updated)
        return updated
      })
      setEditingField(null)
    } else {
      onSaveCompany?.(localCompany)
    }
  }

  // Dialog open helpers
  const openCreate = (type: 'agent' | 'skill' | 'tool' | 'integration') => {
    setEditId(null)
    setDialogType(type)
  }

  const openEdit = (type: 'agent' | 'skill' | 'tool' | 'integration', id: string) => {
    setEditId(id)
    setDialogType(type)
  }

  const closeDialog = () => {
    setDialogType(null)
    setEditId(null)
  }

  const thStyle: React.CSSProperties = {
    padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center',
    whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)',
  }

  const thRoleStyle: React.CSSProperties = { ...thStyle, textAlign: 'left', minWidth: 110 }

  const tdStyle: React.CSSProperties = {
    padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--border)',
  }

  const tdRoleStyle: React.CSSProperties = {
    ...tdStyle, textAlign: 'left', fontSize: 13, fontWeight: 500, color: 'var(--text)', paddingLeft: 12,
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'users':
        return (
          <div style={{ padding: '24px' }}>
            <UserTable users={users} onEdit={onEditUser} onInvite={onInviteUser} onDelete={onDeleteUser} onChangeRole={onChangeRole} onChangeStatus={onChangeStatus} />
          </div>
        )

      case 'plugins':
        return (
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t('settings.plugins')}</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Extend RUN with plugins that provide tools and integrations.</p>
              </div>
              {onSyncPluginRegistry && (
                <Button variant="secondary" size="sm" onClick={onSyncPluginRegistry} loading={syncingPlugins}>
                  Sync Registry
                </Button>
              )}
            </div>

            {/* Tabs: Installed / Marketplace */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
              {(['installed', 'marketplace'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPluginTab(tab)}
                  style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: pluginTab === tab ? 600 : 400,
                    color: pluginTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                    borderBottom: pluginTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                    background: 'none', border: 'none', borderBottomStyle: 'solid',
                    cursor: 'pointer', fontFamily: 'inherit',
                    marginBottom: -1,
                  }}
                >
                  {tab === 'installed' ? `Installed (${localInstalled.length})` : `Marketplace (${localMarketplace.length})`}
                </button>
              ))}
            </div>

            {/* Installed tab */}
            {pluginTab === 'installed' && (
              <>
                {localInstalled.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {localInstalled.map((plugin) => (
                      <PluginCard
                        key={plugin.name}
                        {...plugin}
                        onConfigure={() => onConfigurePlugin?.(plugin.name)}
                        onUninstall={() => handleUninstall(plugin.name)}
                        onToggle={onTogglePlugin ? (enabled) => onTogglePlugin(plugin.name, enabled) : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('settings.noPluginsInstalled')} <button onClick={() => setPluginTab('marketplace')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, padding: 0 }}>{t('settings.marketplace')}</button> {t('settings.noPluginsInstalledSuffix')}
                  </div>
                )}
              </>
            )}

            {/* Marketplace tab */}
            {pluginTab === 'marketplace' && (
              <>
                {localMarketplace.length > 0 ? (
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      {filteredMarketplace.length} plugins available
                      {pluginSearch || pluginCategory !== 'all' ? ` (filtered from ${localMarketplace.length})` : ''}
                    </p>

                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: 12 }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder={t('settings.searchPlugins')}
                        value={pluginSearch}
                        onChange={(e) => setPluginSearch(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 12px 8px 30px', borderRadius: 8,
                          border: '1px solid var(--border)', background: 'var(--surface)',
                          color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                          outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Category filters */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
                      {PLUGIN_CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          onClick={() => setPluginCategory(cat.value)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit',
                            border: '1px solid ' + (pluginCategory === cat.value ? 'var(--accent)' : 'var(--border)'),
                            background: pluginCategory === cat.value ? 'var(--accent-light)' : 'transparent',
                            color: pluginCategory === cat.value ? 'var(--accent)' : 'var(--text-muted)',
                            cursor: 'pointer', fontWeight: pluginCategory === cat.value ? 600 : 400,
                          }}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Plugin grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {visibleMarketplace.map((plugin) => (
                        <PluginCard key={plugin.name} {...plugin} onInstall={() => handleInstall(plugin.name)} />
                      ))}
                    </div>

                    {/* Load more */}
                    {hasMoreMarketplace && (
                      <div style={{ textAlign: 'center', marginTop: 16 }}>
                        <button
                          onClick={() => setMarketplacePage((p) => p + 1)}
                          style={{
                            padding: '8px 24px', borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
                            border: '1px solid var(--border)', background: 'var(--surface)',
                            color: 'var(--text)', cursor: 'pointer',
                          }}
                        >
                          Load more ({filteredMarketplace.length - visibleMarketplace.length} remaining)
                        </button>
                      </div>
                    )}

                    {filteredMarketplace.length === 0 && (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        No plugins match your search.
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No plugins available. Click "Sync Registry" to load the plugin catalog.
                  </div>
                )}
              </>
            )}
          </div>
        )

      case 'agents':
        return (
          <div style={{ padding: '24px' }}>
            <SectionHeader title={t('agents.title')} subtitle={t('settings.agentsSubtitle')} onNew={onCreateAgent ? () => openCreate('agent') : undefined} newLabel={t('new')} />
            {agents.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No agents created yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {agents.map((a) => (
                  <AgentCard
                    key={a.id}
                    id={a.id}
                    name={a.name}
                    description={a.description}
                    avatar={a.avatar}
                    skillCount={a.skillCount}
                    toolCount={a.toolCount}
                    onEdit={onUpdateAgent ? (id) => openEdit('agent', id) : undefined}
                    onDelete={onDeleteAgent}
                  />
                ))}
              </div>
            )}
          </div>
        )

      case 'skills':
        return (
          <div style={{ padding: '24px' }}>
            <SectionHeader title={t('skills.title')} subtitle={t('settings.skillsSubtitle')} onNew={onCreateSkill ? () => openCreate('skill') : undefined} newLabel={t('new')} />
            {skills.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No skills created yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {skills.map((s) => (
                  <SkillCard
                    key={s.id}
                    id={s.id}
                    name={s.name}
                    description={s.description}
                    toolCount={s.toolCount}
                    hasGuardrails={s.hasGuardrails}
                    onEdit={onUpdateSkill ? (id) => openEdit('skill', id) : undefined}
                    onDelete={onDeleteSkill}
                  />
                ))}
              </div>
            )}
          </div>
        )

      case 'tools':
        return (
          <div style={{ padding: '24px' }}>
            <SectionHeader title={t('customTools.title')} subtitle={t('settings.toolsSubtitle')} onNew={onCreateTool ? () => openCreate('tool') : undefined} newLabel={t('new')} />

            {/* Custom tools */}
            {customTools.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('customTools.title')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {customTools.map((t) => (
                    <CustomToolCard
                      key={t.id}
                      id={t.id}
                      name={t.name}
                      description={t.description}
                      type={t.type}
                      integrationName={t.integrationName}
                      onEdit={onUpdateTool ? (id) => openEdit('tool', id) : undefined}
                      onDelete={onDeleteTool}
                      onTest={onTestTool ? () => openEdit('tool', t.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Piece plugin tools */}
            {pieceTools.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('settings.pluginTools')}</h3>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                  {/* Search */}
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder={t('settings.searchTools')}
                      value={toolSearch}
                      onChange={(e) => setToolSearch(e.target.value)}
                      style={{
                        width: '100%', padding: '7px 12px 7px 30px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  {/* Plugin filter */}
                  <select
                    value={toolFilter}
                    onChange={(e) => setToolFilter(e.target.value)}
                    style={{
                      padding: '7px 12px', borderRadius: 8,
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', cursor: 'pointer',
                    }}
                  >
                    <option value="all">{t('settings.allPlugins')}</option>
                    {pieceToolPlugins.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {filteredPieceTools.length} tools{toolFilter !== 'all' || toolSearch ? ' (filtered)' : ''}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {filteredPieceTools.map((t) => (
                    <div
                      key={t.name}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--surface)',
                      }}
                    >
                      {t.pluginLogoUrl ? (
                        <img
                          src={t.pluginLogoUrl}
                          alt={t.pluginName}
                          style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{
                          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                          background: 'var(--surface-2)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--accent)', fontSize: 12, fontWeight: 700,
                        }}>
                          {t.pluginName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.displayName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {filteredPieceTools.length === 0 && (
                  <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No tools match your search.
                  </div>
                )}
              </div>
            )}

            {customTools.length === 0 && pieceTools.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No tools available. Install plugins to add tools, or create custom tools.
              </div>
            )}
          </div>
        )

      case 'integrations':
        return (
          <div style={{ padding: '24px' }}>
            <SectionHeader title={t('integrations.title')} subtitle={t('settings.integrationsSubtitle')} onNew={onCreateIntegration ? () => openCreate('integration') : undefined} newLabel={t('new')} />
            {integrations.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No integrations configured yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {integrations.map((i) => (
                  <IntegrationCard
                    key={i.id}
                    id={i.id}
                    name={i.name}
                    description={i.description}
                    type={i.type}
                    enabled={i.enabled}
                    onToggle={onToggleIntegration}
                    onConfigure={onUpdateIntegration ? (id) => openEdit('integration', id) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )

      case 'permissions':
        return (
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('settings.permissions')}</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Manage role-based access controls. Administrator permissions are fixed and cannot be changed.</p>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th scope="col" style={thRoleStyle}>Role</th>
                    {PERMISSIONS.map((p) => <th key={p} scope="col" style={thStyle}>{p}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((role, ri) => {
                    const isAdmin = role === 'Administrator'
                    return (
                      <tr key={role} style={{ background: ri % 2 === 0 ? 'transparent' : 'var(--surface-2)' }}>
                        <td style={tdRoleStyle}>{role}</td>
                        {PERMISSIONS.map((permission) => (
                          <td key={permission} style={tdStyle}>
                            <input
                              type="checkbox"
                              checked={permissions[role][permission]}
                              disabled={isAdmin}
                              aria-disabled={isAdmin ? 'true' : undefined}
                              aria-label={isAdmin ? `${permission} — locked for Administrator` : undefined}
                              onChange={(e) => handlePermissionChange(role, permission, e.target.checked)}
                              style={{ width: 15, height: 15, cursor: isAdmin ? 'not-allowed' : 'pointer', accentColor: 'var(--accent)', opacity: isAdmin ? 0.6 : 1 }}
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )

      case 'company':
        return (
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('settings.company')}</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Organization information. Click a field to edit it.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(Object.keys(COMPANY_FIELD_LABELS) as (keyof CompanyInfo)[]).map((field) => {
                const label = COMPANY_FIELD_LABELS[field]
                const value = localCompany[field]
                const isReadOnly = READ_ONLY_FIELDS.includes(field)
                const isEditing = editingField === field

                return (
                  <div
                    key={field}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '14px 16px',
                      background: 'var(--surface)', borderRadius: 8,
                      border: isEditing ? '1px solid var(--accent)' : '1px solid var(--border)',
                      gap: 16, cursor: isReadOnly ? 'default' : 'pointer',
                    }}
                    onClick={() => !isEditing && startEditField(field)}
                  >
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 140, flexShrink: 0 }}>{label}</span>
                    {isEditing ? (
                      <input
                        autoFocus
                        aria-label={`Edit ${label} field`}
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={commitField}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitField()
                          if (e.key === 'Escape') setEditingField(null)
                        }}
                        style={{ flex: 1, fontSize: 13, color: 'var(--text)', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit', padding: 0 }}
                      />
                    ) : (
                      <span style={{ fontSize: 13, color: isReadOnly ? 'var(--text-muted)' : 'var(--text)', flex: 1 }}>
                        {value || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('notSet')}</span>}
                      </span>
                    )}
                    {!isEditing && !isReadOnly && <ChevronRight size={14} color="var(--text-muted)" />}
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 20 }}>
              <Button variant="primary" onClick={handleSaveCompany}>{t('saveChanges')}</Button>
            </div>
          </div>
        )
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{ width: 240, minWidth: 240, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 12px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{t('settings.title')}</span>
        </div>
        <div style={{ padding: '8px 0' }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSection(item.id)}
              style={{
                width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
                background: activeSection === item.id ? 'var(--accent-light)' : 'transparent',
                border: 'none', borderLeft: activeSection === item.id ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s', fontFamily: 'inherit',
              }}
            >
              <span style={{ color: activeSection === item.id ? 'var(--accent)' : 'var(--text-muted)' }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: activeSection === item.id ? 'var(--accent)' : 'var(--text)', fontWeight: activeSection === item.id ? 500 : 400 }}>
                {item.label}
              </span>
              {activeSection === item.id && <ChevronRight size={12} color="var(--accent)" style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport style={{ height: '100%' }}>
          {renderContent()}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" style={{ width: 8 }}>
          <ScrollArea.Thumb style={{ background: 'var(--border)', borderRadius: 4 }} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      {/* Dialogs */}
      <FormDialog open={dialogType === 'agent'} onClose={closeDialog} title={editId ? t('agents.editAgent') : t('agents.newAgent')} closeLabel={t('close')}>
        <AgentForm
          initialData={editId ? (() => {
            const a = agents.find((x) => x.id === editId)
            return a ? {
              name: a.name,
              description: a.description ?? '',
              systemPrompt: a.systemPrompt ?? '',
              modelId: a.modelId ?? '',
              skillIds: a.skillIds ?? [],
              toolIds: a.toolIds ?? [],
            } : undefined
          })() : undefined}
          skillOptions={skillOptions}
          toolOptions={toolOptions}
          onSubmit={(data) => {
            if (editId) onUpdateAgent?.(editId, data)
            else onCreateAgent?.(data)
            closeDialog()
          }}
          onCancel={closeDialog}
          loading={formLoading}
        />
      </FormDialog>

      <FormDialog open={dialogType === 'skill'} onClose={closeDialog} title={editId ? t('skills.editSkill') : t('skills.newSkill')} closeLabel={t('close')}>
        <SkillForm
          initialData={editId ? (() => {
            const s = skills.find((x) => x.id === editId)
            return s ? { name: s.name, description: s.description ?? '' } : undefined
          })() : undefined}
          toolOptions={toolOptions}
          systemToolOptions={systemToolOptions}
          onSubmit={(data) => {
            if (editId) onUpdateSkill?.(editId, data)
            else onCreateSkill?.(data)
            closeDialog()
          }}
          onCancel={closeDialog}
          loading={formLoading}
        />
      </FormDialog>

      <FormDialog open={dialogType === 'tool'} onClose={closeDialog} title={editId ? t('customTools.editTool') : t('customTools.newTool')} closeLabel={t('close')}>
        <CustomToolForm
          initialData={editId ? (() => {
            const t = customTools.find((x) => x.id === editId)
            return t ? { name: t.name, description: t.description ?? '', type: t.type } : undefined
          })() : undefined}
          integrationOptions={integrationOptions}
          onSubmit={(data) => {
            if (editId) onUpdateTool?.(editId, data)
            else onCreateTool?.(data)
            closeDialog()
          }}
          onCancel={closeDialog}
          onTest={onTestTool}
          testResult={testResult}
          loading={formLoading}
        />
      </FormDialog>

      <FormDialog open={dialogType === 'integration'} onClose={closeDialog} title={editId ? t('integrations.editIntegration') : t('integrations.newIntegration')} closeLabel={t('close')}>
        <IntegrationForm
          initialData={editId ? (() => {
            const i = integrations.find((x) => x.id === editId)
            return i ? { name: i.name, description: i.description ?? '', type: i.type } : undefined
          })() : undefined}
          onSubmit={(data) => {
            if (editId) onUpdateIntegration?.(editId, data)
            else onCreateIntegration?.(data)
            closeDialog()
          }}
          onCancel={closeDialog}
          onOAuthConnect={onOAuthConnect}
          loading={formLoading}
        />
      </FormDialog>

    </div>
  )
}

export default SettingsScreen
