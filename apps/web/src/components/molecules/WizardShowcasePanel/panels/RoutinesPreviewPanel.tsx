import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Table, ArrowRight, Layers, Link2, FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface RoutinesPreviewPanelProps {
  selectedRoutineIds: string[]
}

interface EntityNode {
  id: string
  label: string
  category: string
}

interface EntityRelation {
  from: string
  to: string
}

const ROUTINE_ENTITIES: Record<string, EntityNode[]> = {
  'lead-capture': [
    { id: 'leads', label: 'Leads', category: 'sales' },
    { id: 'channels', label: 'Channels', category: 'sales' },
  ],
  'sales-pipeline': [
    { id: 'leads', label: 'Leads', category: 'sales' },
    { id: 'opportunities', label: 'Opportunities', category: 'sales' },
    { id: 'deals', label: 'Deals', category: 'sales' },
  ],
  'quotation-mgmt': [
    { id: 'quotes', label: 'Quotes', category: 'sales' },
    { id: 'customers', label: 'Customers', category: 'sales' },
  ],
  'customer-crm': [
    { id: 'customers', label: 'Customers', category: 'sales' },
    { id: 'contacts', label: 'Contacts', category: 'sales' },
    { id: 'interactions', label: 'Interactions', category: 'sales' },
  ],
  'order-processing': [
    { id: 'orders', label: 'Orders', category: 'sales' },
    { id: 'customers', label: 'Customers', category: 'sales' },
    { id: 'products', label: 'Products', category: 'inventory' },
  ],
  'commission-tracking': [
    { id: 'commissions', label: 'Commissions', category: 'sales' },
    { id: 'deals', label: 'Deals', category: 'sales' },
  ],
  'accounts-receivable': [
    { id: 'invoices', label: 'Invoices', category: 'finance' },
    { id: 'payments', label: 'Payments', category: 'finance' },
    { id: 'customers', label: 'Customers', category: 'sales' },
  ],
  'accounts-payable': [
    { id: 'bills', label: 'Bills', category: 'finance' },
    { id: 'vendors', label: 'Vendors', category: 'finance' },
    { id: 'payments', label: 'Payments', category: 'finance' },
  ],
  'cash-flow': [
    { id: 'transactions', label: 'Transactions', category: 'finance' },
    { id: 'bank-accounts', label: 'Bank Accounts', category: 'finance' },
  ],
  'expense-tracking': [
    { id: 'expenses', label: 'Expenses', category: 'finance' },
    { id: 'categories', label: 'Categories', category: 'finance' },
  ],
  'tax-management': [
    { id: 'tax-records', label: 'Tax Records', category: 'finance' },
    { id: 'invoices', label: 'Invoices', category: 'finance' },
  ],
  'budget-planning': [
    { id: 'budgets', label: 'Budgets', category: 'finance' },
    { id: 'departments', label: 'Departments', category: 'hr' },
  ],
  'stock-control': [
    { id: 'products', label: 'Products', category: 'inventory' },
    { id: 'stock-levels', label: 'Stock Levels', category: 'inventory' },
    { id: 'warehouses', label: 'Warehouses', category: 'inventory' },
  ],
  'purchase-orders': [
    { id: 'purchase-orders', label: 'Purchase Orders', category: 'inventory' },
    { id: 'vendors', label: 'Vendors', category: 'finance' },
    { id: 'products', label: 'Products', category: 'inventory' },
  ],
  'supplier-mgmt': [
    { id: 'vendors', label: 'Vendors', category: 'finance' },
    { id: 'contracts', label: 'Contracts', category: 'operations' },
  ],
  'product-catalog': [
    { id: 'products', label: 'Products', category: 'inventory' },
    { id: 'categories', label: 'Categories', category: 'finance' },
  ],
  'warehouse-mgmt': [
    { id: 'warehouses', label: 'Warehouses', category: 'inventory' },
    { id: 'stock-levels', label: 'Stock Levels', category: 'inventory' },
  ],
  'inventory-audit': [
    { id: 'audits', label: 'Audits', category: 'inventory' },
    { id: 'products', label: 'Products', category: 'inventory' },
  ],
  'employee-registry': [
    { id: 'employees', label: 'Employees', category: 'hr' },
    { id: 'departments', label: 'Departments', category: 'hr' },
  ],
  'time-attendance': [
    { id: 'time-entries', label: 'Time Entries', category: 'hr' },
    { id: 'employees', label: 'Employees', category: 'hr' },
  ],
  'payroll': [
    { id: 'payroll-records', label: 'Payroll', category: 'hr' },
    { id: 'employees', label: 'Employees', category: 'hr' },
  ],
  'leave-mgmt': [
    { id: 'leave-requests', label: 'Leave Requests', category: 'hr' },
    { id: 'employees', label: 'Employees', category: 'hr' },
  ],
  'recruitment': [
    { id: 'candidates', label: 'Candidates', category: 'hr' },
    { id: 'job-openings', label: 'Job Openings', category: 'hr' },
  ],
  'training': [
    { id: 'training-programs', label: 'Programs', category: 'hr' },
    { id: 'employees', label: 'Employees', category: 'hr' },
  ],
  'project-mgmt': [
    { id: 'projects', label: 'Projects', category: 'operations' },
    { id: 'tasks', label: 'Tasks', category: 'operations' },
    { id: 'employees', label: 'Employees', category: 'hr' },
  ],
  'service-tickets': [
    { id: 'tickets', label: 'Tickets', category: 'operations' },
    { id: 'customers', label: 'Customers', category: 'sales' },
  ],
  'scheduling': [
    { id: 'appointments', label: 'Appointments', category: 'operations' },
    { id: 'customers', label: 'Customers', category: 'sales' },
  ],
  'quality-control': [
    { id: 'inspections', label: 'Inspections', category: 'operations' },
    { id: 'products', label: 'Products', category: 'inventory' },
  ],
  'fleet-tracking': [
    { id: 'vehicles', label: 'Vehicles', category: 'operations' },
    { id: 'maintenance-logs', label: 'Maintenance', category: 'operations' },
  ],
  'document-mgmt': [
    { id: 'documents', label: 'Documents', category: 'operations' },
    { id: 'contracts', label: 'Contracts', category: 'operations' },
  ],
  'maintenance': [
    { id: 'maintenance-logs', label: 'Maintenance', category: 'operations' },
    { id: 'equipment', label: 'Equipment', category: 'operations' },
  ],
  'compliance': [
    { id: 'compliance-items', label: 'Compliance', category: 'operations' },
    { id: 'documents', label: 'Documents', category: 'operations' },
  ],
}

const ALL_RELATIONS: EntityRelation[] = [
  { from: 'leads', to: 'opportunities' },
  { from: 'opportunities', to: 'deals' },
  { from: 'deals', to: 'commissions' },
  { from: 'customers', to: 'orders' },
  { from: 'customers', to: 'invoices' },
  { from: 'customers', to: 'quotes' },
  { from: 'customers', to: 'tickets' },
  { from: 'customers', to: 'appointments' },
  { from: 'customers', to: 'contacts' },
  { from: 'orders', to: 'products' },
  { from: 'orders', to: 'invoices' },
  { from: 'invoices', to: 'payments' },
  { from: 'bills', to: 'payments' },
  { from: 'bills', to: 'vendors' },
  { from: 'purchase-orders', to: 'vendors' },
  { from: 'purchase-orders', to: 'products' },
  { from: 'products', to: 'stock-levels' },
  { from: 'stock-levels', to: 'warehouses' },
  { from: 'employees', to: 'departments' },
  { from: 'employees', to: 'time-entries' },
  { from: 'employees', to: 'payroll-records' },
  { from: 'employees', to: 'leave-requests' },
  { from: 'employees', to: 'training-programs' },
  { from: 'projects', to: 'tasks' },
  { from: 'projects', to: 'employees' },
  { from: 'products', to: 'inspections' },
]

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  sales: { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.3)', text: '#818cf8' },
  finance: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', text: '#34d399' },
  inventory: { bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.3)', text: '#fb923c' },
  hr: { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)', text: '#c084fc' },
  operations: { bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)', text: '#cbd5e1' },
}


export function RoutinesPreviewPanel({ selectedRoutineIds }: RoutinesPreviewPanelProps) {
  const { t } = useTranslation()
  const { entities, relations, categorized } = useMemo(() => {
    const entityMap = new Map<string, EntityNode>()
    for (const routineId of selectedRoutineIds) {
      const nodes = ROUTINE_ENTITIES[routineId]
      if (!nodes) continue
      for (const node of nodes) {
        if (!entityMap.has(node.id)) {
          entityMap.set(node.id, node)
        }
      }
    }

    const entityIds = new Set(entityMap.keys())
    const activeRelations = ALL_RELATIONS.filter(
      (r) => entityIds.has(r.from) && entityIds.has(r.to)
    )

    const byCategory = new Map<string, EntityNode[]>()
    for (const entity of entityMap.values()) {
      const list = byCategory.get(entity.category) || []
      list.push(entity)
      byCategory.set(entity.category, list)
    }

    return {
      entities: Array.from(entityMap.values()),
      relations: activeRelations,
      categorized: byCategory,
    }
  }, [selectedRoutineIds])

  const hasData = entities.length > 0

  return (
    <div
      data-testid="routines-preview-panel"
      style={{
        flex: 1,
        background: 'linear-gradient(135deg, var(--accent) 0%, #C4490A 50%, #9a3412 100%)',
        display: 'flex',
        flexDirection: 'column',
        padding: 32,
        position: 'relative',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      {/* Background pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: -80, right: -60, filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', bottom: -40, left: -40, filter: 'blur(40px)' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait">
          {!hasData ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ textAlign: 'center' }}
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 28px',
                }}
              >
                <Layers size={36} color="rgba(255,255,255,0.8)" />
              </motion.div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff' }}>
                Entity Map
              </h2>
              <p style={{ margin: '12px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                Select routines to see the data entities that will be created.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="data"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            >
              {/* Stats bar */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 24, justifyContent: 'center' }}>
                {[
                  { icon: <Table size={13} />, value: entities.length, label: 'Entities' },
                  { icon: <Link2 size={13} />, value: relations.length, label: 'Relations' },
                  { icon: <FolderOpen size={13} />, value: categorized.size, label: 'Modules' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 20,
                      background: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{stat.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{stat.value}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{stat.label}</span>
                  </div>
                ))}
              </div>

              {/* Category groups */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.35)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: 16,
                  flex: 1,
                  overflowY: 'auto',
                  minHeight: 0,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {Array.from(categorized.entries()).map(([category, categoryEntities]) => {
                      const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.operations
                      return (
                        <motion.div
                          key={category}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.25 }}
                        >
                          {/* Category header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.text }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {t(`routineCategories.${category}`)}
                            </span>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                              {categoryEntities.length}
                            </span>
                          </div>
                          {/* Entity pills */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {categoryEntities.map((entity) => (
                              <motion.div
                                key={entity.id}
                                layout
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2 }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '4px 10px',
                                  borderRadius: 16,
                                  background: colors.bg,
                                  border: `1px solid ${colors.border}`,
                                  fontSize: 11,
                                  fontWeight: 500,
                                  color: colors.text,
                                }}
                              >
                                <Table size={10} />
                                {entity.label}
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>

                {/* Relations */}
                {relations.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                      Relationships
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {relations.slice(0, 12).map((rel) => {
                        const fromEntity = entities.find((e) => e.id === rel.from)
                        const toEntity = entities.find((e) => e.id === rel.to)
                        if (!fromEntity || !toEntity) return null
                        return (
                          <div
                            key={`${rel.from}-${rel.to}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              borderRadius: 12,
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              fontSize: 10,
                              color: 'rgba(255,255,255,0.55)',
                            }}
                          >
                            {fromEntity.label}
                            <ArrowRight size={8} />
                            {toEntity.label}
                          </div>
                        )
                      })}
                      {relations.length > 12 && (
                        <div style={{ padding: '3px 8px', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                          +{relations.length - 12} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default RoutinesPreviewPanel
