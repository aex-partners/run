// Business routine templates for onboarding
// Labels come from i18n: routineCategories.{id} / routines.{i18nKey}.name|description

export type RoutineCategory = 'sales' | 'finance' | 'inventory' | 'hr' | 'operations'

export interface RoutineTemplate {
  id: string
  i18nKey: string
  category: RoutineCategory
  icon: string
  niches: string[]
}

export const ROUTINE_CATEGORY_IDS: RoutineCategory[] = ['sales', 'finance', 'inventory', 'hr', 'operations']

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  // Sales
  { id: 'lead-capture', i18nKey: 'leadCapture', category: 'sales', icon: 'UserPlus', niches: ['retail', 'services', 'technology', 'construction', 'healthcare'] },
  { id: 'sales-pipeline', i18nKey: 'salesPipeline', category: 'sales', icon: 'TrendingUp', niches: ['retail', 'services', 'technology', 'manufacturing', 'construction'] },
  { id: 'quotation-mgmt', i18nKey: 'quotationManagement', category: 'sales', icon: 'FileText', niches: ['services', 'manufacturing', 'construction', 'technology', 'logistics'] },
  { id: 'customer-crm', i18nKey: 'customerCrm', category: 'sales', icon: 'Users', niches: ['retail', 'services', 'healthcare', 'education', 'hospitality', 'technology'] },
  { id: 'order-processing', i18nKey: 'orderProcessing', category: 'sales', icon: 'ShoppingCart', niches: ['retail', 'food-beverage', 'manufacturing', 'logistics', 'agriculture'] },
  { id: 'commission-tracking', i18nKey: 'commissionTracking', category: 'sales', icon: 'DollarSign', niches: ['retail', 'services', 'technology', 'hospitality'] },

  // Finance
  { id: 'accounts-receivable', i18nKey: 'accountsReceivable', category: 'finance', icon: 'Receipt', niches: ['retail', 'services', 'manufacturing', 'construction', 'healthcare', 'technology'] },
  { id: 'accounts-payable', i18nKey: 'accountsPayable', category: 'finance', icon: 'CreditCard', niches: ['retail', 'services', 'manufacturing', 'construction', 'logistics', 'agriculture'] },
  { id: 'cash-flow', i18nKey: 'cashFlow', category: 'finance', icon: 'Wallet', niches: ['retail', 'food-beverage', 'services', 'manufacturing', 'construction', 'technology'] },
  { id: 'expense-tracking', i18nKey: 'expenseTracking', category: 'finance', icon: 'Receipt', niches: ['services', 'technology', 'education', 'healthcare', 'hospitality'] },
  { id: 'tax-management', i18nKey: 'taxManagement', category: 'finance', icon: 'Calculator', niches: ['retail', 'services', 'manufacturing', 'agriculture', 'technology'] },
  { id: 'budget-planning', i18nKey: 'budgetPlanning', category: 'finance', icon: 'PieChart', niches: ['services', 'education', 'healthcare', 'technology', 'manufacturing'] },

  // Inventory
  { id: 'stock-control', i18nKey: 'stockControl', category: 'inventory', icon: 'Package', niches: ['retail', 'food-beverage', 'manufacturing', 'agriculture', 'logistics'] },
  { id: 'purchase-orders', i18nKey: 'purchaseOrders', category: 'inventory', icon: 'ClipboardList', niches: ['retail', 'food-beverage', 'manufacturing', 'construction', 'healthcare'] },
  { id: 'supplier-mgmt', i18nKey: 'supplierManagement', category: 'inventory', icon: 'Truck', niches: ['retail', 'manufacturing', 'construction', 'food-beverage', 'agriculture'] },
  { id: 'product-catalog', i18nKey: 'productCatalog', category: 'inventory', icon: 'Grid3x3', niches: ['retail', 'food-beverage', 'manufacturing', 'technology'] },
  { id: 'warehouse-mgmt', i18nKey: 'warehouseManagement', category: 'inventory', icon: 'Warehouse', niches: ['retail', 'manufacturing', 'logistics', 'agriculture'] },
  { id: 'inventory-audit', i18nKey: 'inventoryAudit', category: 'inventory', icon: 'ClipboardCheck', niches: ['retail', 'manufacturing', 'food-beverage', 'logistics'] },

  // HR
  { id: 'employee-registry', i18nKey: 'employeeRegistry', category: 'hr', icon: 'UserCheck', niches: ['retail', 'services', 'manufacturing', 'construction', 'healthcare', 'education', 'technology'] },
  { id: 'time-attendance', i18nKey: 'timeAttendance', category: 'hr', icon: 'Clock', niches: ['retail', 'food-beverage', 'manufacturing', 'construction', 'healthcare', 'hospitality'] },
  { id: 'payroll', i18nKey: 'payroll', category: 'hr', icon: 'Banknote', niches: ['retail', 'services', 'manufacturing', 'construction', 'healthcare', 'technology'] },
  { id: 'leave-mgmt', i18nKey: 'leaveManagement', category: 'hr', icon: 'CalendarOff', niches: ['services', 'technology', 'education', 'healthcare', 'manufacturing'] },
  { id: 'recruitment', i18nKey: 'recruitment', category: 'hr', icon: 'UserSearch', niches: ['services', 'technology', 'healthcare', 'education', 'manufacturing'] },
  { id: 'training', i18nKey: 'training', category: 'hr', icon: 'GraduationCap', niches: ['services', 'technology', 'healthcare', 'education', 'manufacturing'] },

  // Operations
  { id: 'project-mgmt', i18nKey: 'projectManagement', category: 'operations', icon: 'FolderKanban', niches: ['services', 'technology', 'construction', 'manufacturing', 'education'] },
  { id: 'service-tickets', i18nKey: 'serviceTickets', category: 'operations', icon: 'TicketCheck', niches: ['technology', 'services', 'healthcare', 'hospitality', 'retail'] },
  { id: 'scheduling', i18nKey: 'scheduling', category: 'operations', icon: 'CalendarDays', niches: ['healthcare', 'education', 'hospitality', 'services', 'food-beverage'] },
  { id: 'quality-control', i18nKey: 'qualityControl', category: 'operations', icon: 'ShieldCheck', niches: ['manufacturing', 'food-beverage', 'construction', 'agriculture'] },
  { id: 'fleet-tracking', i18nKey: 'fleetTracking', category: 'operations', icon: 'Car', niches: ['logistics', 'construction', 'agriculture', 'food-beverage'] },
  { id: 'document-mgmt', i18nKey: 'documentManagement', category: 'operations', icon: 'FolderOpen', niches: ['services', 'healthcare', 'education', 'technology', 'construction'] },
  { id: 'maintenance', i18nKey: 'maintenance', category: 'operations', icon: 'Wrench', niches: ['manufacturing', 'hospitality', 'healthcare', 'construction', 'agriculture'] },
  { id: 'compliance', i18nKey: 'compliance', category: 'operations', icon: 'Scale', niches: ['healthcare', 'food-beverage', 'manufacturing', 'services', 'agriculture'] },
]
