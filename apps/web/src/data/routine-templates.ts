// Business routine templates for onboarding

export type RoutineCategory = 'sales' | 'finance' | 'inventory' | 'hr' | 'operations'

export interface RoutineTemplate {
  id: string
  name: string
  description: string
  category: RoutineCategory
  icon: string
  niches: string[]
}

export const ROUTINE_CATEGORIES: { id: RoutineCategory; label: string }[] = [
  { id: 'sales', label: 'Sales' },
  { id: 'finance', label: 'Finance' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'hr', label: 'HR' },
  { id: 'operations', label: 'Operations' },
]

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  // Sales
  { id: 'lead-capture', name: 'Lead Capture', description: 'Track and qualify incoming leads from multiple channels', category: 'sales', icon: 'UserPlus', niches: ['retail', 'services', 'technology', 'construction', 'healthcare'] },
  { id: 'sales-pipeline', name: 'Sales Pipeline', description: 'Manage deals through customizable sales stages', category: 'sales', icon: 'TrendingUp', niches: ['retail', 'services', 'technology', 'manufacturing', 'construction'] },
  { id: 'quotation-mgmt', name: 'Quotation Management', description: 'Create, send, and track quotes and proposals', category: 'sales', icon: 'FileText', niches: ['services', 'manufacturing', 'construction', 'technology', 'logistics'] },
  { id: 'customer-crm', name: 'Customer CRM', description: 'Centralized customer database with interaction history', category: 'sales', icon: 'Users', niches: ['retail', 'services', 'healthcare', 'education', 'hospitality', 'technology'] },
  { id: 'order-processing', name: 'Order Processing', description: 'Handle orders from creation to fulfillment', category: 'sales', icon: 'ShoppingCart', niches: ['retail', 'food-beverage', 'manufacturing', 'logistics', 'agriculture'] },
  { id: 'commission-tracking', name: 'Commission Tracking', description: 'Calculate and track sales commissions automatically', category: 'sales', icon: 'DollarSign', niches: ['retail', 'services', 'technology', 'hospitality'] },

  // Finance
  { id: 'accounts-receivable', name: 'Accounts Receivable', description: 'Track invoices, payments, and outstanding balances', category: 'finance', icon: 'Receipt', niches: ['retail', 'services', 'manufacturing', 'construction', 'healthcare', 'technology'] },
  { id: 'accounts-payable', name: 'Accounts Payable', description: 'Manage bills, vendor payments, and due dates', category: 'finance', icon: 'CreditCard', niches: ['retail', 'services', 'manufacturing', 'construction', 'logistics', 'agriculture'] },
  { id: 'cash-flow', name: 'Cash Flow', description: 'Monitor daily cash flow and bank reconciliation', category: 'finance', icon: 'Wallet', niches: ['retail', 'food-beverage', 'services', 'manufacturing', 'construction', 'technology'] },
  { id: 'expense-tracking', name: 'Expense Tracking', description: 'Record and categorize business expenses', category: 'finance', icon: 'Receipt', niches: ['services', 'technology', 'education', 'healthcare', 'hospitality'] },
  { id: 'tax-management', name: 'Tax Management', description: 'Track tax obligations and prepare filing data', category: 'finance', icon: 'Calculator', niches: ['retail', 'services', 'manufacturing', 'agriculture', 'technology'] },
  { id: 'budget-planning', name: 'Budget Planning', description: 'Create and monitor departmental budgets', category: 'finance', icon: 'PieChart', niches: ['services', 'education', 'healthcare', 'technology', 'manufacturing'] },

  // Inventory
  { id: 'stock-control', name: 'Stock Control', description: 'Track inventory levels with alerts for low stock', category: 'inventory', icon: 'Package', niches: ['retail', 'food-beverage', 'manufacturing', 'agriculture', 'logistics'] },
  { id: 'purchase-orders', name: 'Purchase Orders', description: 'Create and manage supplier purchase orders', category: 'inventory', icon: 'ClipboardList', niches: ['retail', 'food-beverage', 'manufacturing', 'construction', 'healthcare'] },
  { id: 'supplier-mgmt', name: 'Supplier Management', description: 'Maintain supplier database with pricing and terms', category: 'inventory', icon: 'Truck', niches: ['retail', 'manufacturing', 'construction', 'food-beverage', 'agriculture'] },
  { id: 'product-catalog', name: 'Product Catalog', description: 'Organize products with categories, images, and pricing', category: 'inventory', icon: 'Grid3x3', niches: ['retail', 'food-beverage', 'manufacturing', 'technology'] },
  { id: 'warehouse-mgmt', name: 'Warehouse Management', description: 'Manage storage locations and bin assignments', category: 'inventory', icon: 'Warehouse', niches: ['retail', 'manufacturing', 'logistics', 'agriculture'] },
  { id: 'inventory-audit', name: 'Inventory Audit', description: 'Schedule and track physical inventory counts', category: 'inventory', icon: 'ClipboardCheck', niches: ['retail', 'manufacturing', 'food-beverage', 'logistics'] },

  // HR
  { id: 'employee-registry', name: 'Employee Registry', description: 'Maintain employee records and documentation', category: 'hr', icon: 'UserCheck', niches: ['retail', 'services', 'manufacturing', 'construction', 'healthcare', 'education', 'technology'] },
  { id: 'time-attendance', name: 'Time & Attendance', description: 'Track work hours, shifts, and attendance', category: 'hr', icon: 'Clock', niches: ['retail', 'food-beverage', 'manufacturing', 'construction', 'healthcare', 'hospitality'] },
  { id: 'payroll', name: 'Payroll', description: 'Process salary calculations and payment records', category: 'hr', icon: 'Banknote', niches: ['retail', 'services', 'manufacturing', 'construction', 'healthcare', 'technology'] },
  { id: 'leave-mgmt', name: 'Leave Management', description: 'Handle vacation requests and leave balances', category: 'hr', icon: 'CalendarOff', niches: ['services', 'technology', 'education', 'healthcare', 'manufacturing'] },
  { id: 'recruitment', name: 'Recruitment', description: 'Track job openings, candidates, and hiring pipeline', category: 'hr', icon: 'UserSearch', niches: ['services', 'technology', 'healthcare', 'education', 'manufacturing'] },
  { id: 'training', name: 'Training & Development', description: 'Manage training programs and certifications', category: 'hr', icon: 'GraduationCap', niches: ['services', 'technology', 'healthcare', 'education', 'manufacturing'] },

  // Operations
  { id: 'project-mgmt', name: 'Project Management', description: 'Plan and track projects with milestones and deadlines', category: 'operations', icon: 'FolderKanban', niches: ['services', 'technology', 'construction', 'manufacturing', 'education'] },
  { id: 'service-tickets', name: 'Service Tickets', description: 'Manage customer support and service requests', category: 'operations', icon: 'TicketCheck', niches: ['technology', 'services', 'healthcare', 'hospitality', 'retail'] },
  { id: 'scheduling', name: 'Scheduling', description: 'Manage appointments, bookings, and resource allocation', category: 'operations', icon: 'CalendarDays', niches: ['healthcare', 'education', 'hospitality', 'services', 'food-beverage'] },
  { id: 'quality-control', name: 'Quality Control', description: 'Track inspections, defects, and quality metrics', category: 'operations', icon: 'ShieldCheck', niches: ['manufacturing', 'food-beverage', 'construction', 'agriculture'] },
  { id: 'fleet-tracking', name: 'Fleet Tracking', description: 'Monitor vehicles, maintenance, and fuel consumption', category: 'operations', icon: 'Car', niches: ['logistics', 'construction', 'agriculture', 'food-beverage'] },
  { id: 'document-mgmt', name: 'Document Management', description: 'Organize contracts, certificates, and business documents', category: 'operations', icon: 'FolderOpen', niches: ['services', 'healthcare', 'education', 'technology', 'construction'] },
  { id: 'maintenance', name: 'Maintenance', description: 'Schedule and track equipment and facility maintenance', category: 'operations', icon: 'Wrench', niches: ['manufacturing', 'hospitality', 'healthcare', 'construction', 'agriculture'] },
  { id: 'compliance', name: 'Compliance', description: 'Track regulatory requirements and compliance deadlines', category: 'operations', icon: 'Scale', niches: ['healthcare', 'food-beverage', 'manufacturing', 'services', 'agriculture'] },
]
