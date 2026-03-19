import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { DataGrid } from './DataGrid'

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

const largeRows = [
  ...mockRows,
  { id: 'CLI-006', name: 'Zeta Supplies', city: 'Phoenix', status: 'Active', orders: 22, total: 54000 },
  { id: 'CLI-007', name: 'Eta Partners', city: 'Philadelphia', status: 'Pending', orders: 3, total: 9800 },
  { id: 'CLI-008', name: 'Theta Corp', city: 'San Antonio', status: 'Active', orders: 55, total: 210000 },
  { id: 'CLI-009', name: 'Iota Holdings', city: 'San Diego', status: 'Inactive', orders: 0, total: 0 },
  { id: 'CLI-010', name: 'Kappa Ventures', city: 'Dallas', status: 'Active', orders: 14, total: 47300 },
  { id: 'CLI-011', name: 'Lambda Inc', city: 'San Jose', status: 'Active', orders: 9, total: 32100 },
  { id: 'CLI-012', name: 'Mu Retail', city: 'Austin', status: 'Pending', orders: 1, total: 4200 },
  { id: 'CLI-013', name: 'Nu Exports', city: 'Jacksonville', status: 'Active', orders: 38, total: 143000 },
  { id: 'CLI-014', name: 'Xi Industries', city: 'Fort Worth', status: 'Inactive', orders: 2, total: 8900 },
  { id: 'CLI-015', name: 'Omicron LLC', city: 'Columbus', status: 'Active', orders: 27, total: 91500 },
  { id: 'CLI-016', name: 'Pi Trading', city: 'Charlotte', status: 'Active', orders: 11, total: 39200 },
  { id: 'CLI-017', name: 'Rho Logistics', city: 'Indianapolis', status: 'Pending', orders: 0, total: 0 },
  { id: 'CLI-018', name: 'Sigma Wholesale', city: 'San Francisco', status: 'Active', orders: 61, total: 277000 },
  { id: 'CLI-019', name: 'Tau Commerce', city: 'Seattle', status: 'Active', orders: 19, total: 68400 },
  { id: 'CLI-020', name: 'Upsilon Group', city: 'Denver', status: 'Inactive', orders: 4, total: 15600 },
]

const meta: Meta<typeof DataGrid> = {
  title: 'Organisms/DataGrid',
  component: DataGrid,
  tags: ['data'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onAddRow: { action: 'add-row' },
    onAddColumn: { action: 'add-column' },
    onSelectRow: { action: 'select-row' },
    onCellEdit: { action: 'cell-edit' },
  },
  args: { onAddRow: fn(), onAddColumn: fn(), onSelectRow: fn(), onCellEdit: fn() },
  decorators: [(Story) => <div style={{ height: 500 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof DataGrid>

export const Default: Story = {
  args: { columns: mockColumns, rows: mockRows, title: 'Customers' },
}

export const Empty: Story = {
  args: { columns: mockColumns, rows: [], title: 'Customers' },
}

export const WithSelection: Story = {
  args: {
    columns: mockColumns,
    rows: mockRows,
    title: 'Customers',
    selectedRows: ['CLI-001', 'CLI-003'],
  },
}

/** Click any text or number cell to edit inline. Press Enter or click away to confirm. */
export const InlineEditing: Story = {
  name: 'Inline Editing',
  args: {
    columns: mockColumns,
    rows: mockRows,
    title: 'Customers (click a cell to edit)',
  },
}

/** Click the Filter button to show the search row, then type to narrow down records. */
export const WithFilter: Story = {
  name: 'With Filter',
  parameters: {
    docs: {
      description: {
        story: 'Click the Filter button to show the search row',
      },
    },
  },
  args: {
    columns: mockColumns,
    rows: mockRows,
    title: 'Customers',
  },
}

/** Click the Columns button to show/hide individual columns using the popover. */
export const WithColumnToggle: Story = {
  name: 'Column Toggle',
  parameters: {
    docs: {
      description: {
        story: 'Click the Columns button to show/hide columns',
      },
    },
  },
  args: {
    columns: mockColumns,
    rows: mockRows,
    title: 'Customers',
  },
}

/** Hover a row and click ··· to open the row menu, then choose Delete row. */
export const WithRowDelete: Story = {
  name: 'Row Delete',
  parameters: {
    docs: {
      description: {
        story: 'Hover a row and click ··· to delete it',
      },
    },
  },
  args: {
    columns: mockColumns,
    rows: mockRows,
    title: 'Customers',
  },
}

/** Scroll vertically through a large dataset of 20+ records. */
export const LargeDataset: Story = {
  name: 'Large Dataset',
  args: {
    columns: mockColumns,
    rows: largeRows,
    title: 'All Customers',
  },
}

// Monday.com-style columns
const mondayColumns = [
  { id: 'id', label: 'ID', type: 'text' as const, width: 80 },
  { id: 'name', label: 'Name', type: 'text' as const, width: 180 },
  { id: 'owner', label: 'Owner', type: 'person' as const, width: 120 },
  {
    id: 'status', label: 'Status', type: 'status' as const, width: 130,
    statusColors: {
      'Done': '#00c875',
      'Working on it': '#fdab3d',
      'Stuck': '#e2445c',
      'Not started': '#c4c4c4',
    },
  },
  { id: 'priority', label: 'Priority', type: 'priority' as const, width: 120 },
  { id: 'budget', label: 'Budget', type: 'currency' as const, width: 130, currencyCode: 'USD' },
  { id: 'timeline', label: 'Timeline', type: 'timeline' as const, width: 180 },
]

const mondayRows = [
  { id: 'TSK-001', name: 'Website Redesign', owner: 'Ana Silva', status: 'Working on it', priority: 'High', budget: 15000, timeline: '2026-03-01|2026-03-20', _groupId: 'active' },
  { id: 'TSK-002', name: 'Mobile App v2', owner: 'Carlos Mendes', status: 'Done', priority: 'Critical', budget: 42000, timeline: '2026-02-01|2026-03-10', _groupId: 'active' },
  { id: 'TSK-003', name: 'API Integration', owner: 'Pedro Costa, Maria Souza', status: 'Stuck', priority: 'High', budget: 8500, timeline: '2026-03-05|2026-03-15', _groupId: 'active' },
  { id: 'TSK-004', name: 'Database Migration', owner: 'Lucas Oliveira', status: 'Working on it', priority: 'Medium', budget: 12000, timeline: '2026-03-10|2026-04-05', _groupId: 'active' },
  { id: 'TSK-005', name: 'Security Audit', owner: 'Fernanda Lima', status: 'Not started', priority: 'Low', budget: 5000, timeline: '2026-04-01|2026-04-15', _groupId: 'backlog' },
  { id: 'TSK-006', name: 'Design System', owner: 'Ana Silva', status: 'Not started', priority: 'Medium', budget: 7500, timeline: '2026-04-10|2026-05-01', _groupId: 'backlog' },
  { id: 'TSK-007', name: 'Performance Tuning', owner: 'Carlos Mendes', status: 'Not started', priority: 'Low', budget: 3000, timeline: '2026-05-01|2026-05-15', _groupId: 'backlog' },
]

const mondayGroups = [
  { id: 'active', label: 'Active Sprint', color: '#579bfc' },
  { id: 'backlog', label: 'Backlog', color: '#a25ddc' },
]

/** Monday.com-style grid with groups, status pills, avatars, currency, and timeline bars. */
export const MondayStyle: Story = {
  name: 'Monday Style',
  args: {
    columns: mondayColumns,
    rows: mondayRows,
    title: 'Project Tasks',
    groups: mondayGroups,
  },
}

/** Two color-coded groups with collapse/expand. */
export const WithGroups: Story = {
  name: 'With Groups',
  args: {
    columns: mockColumns,
    rows: [
      { id: 'CLI-001', name: 'Acme Distributors', city: 'New York', status: 'Active', orders: 42, total: 184500, _groupId: 'vip' },
      { id: 'CLI-002', name: 'Beta Commerce', city: 'Los Angeles', status: 'Active', orders: 18, total: 67200, _groupId: 'vip' },
      { id: 'CLI-003', name: 'Gamma Tech', city: 'Chicago', status: 'Inactive', orders: 5, total: 12300, _groupId: 'regular' },
      { id: 'CLI-004', name: 'Delta Industries', city: 'Houston', status: 'Active', orders: 31, total: 95800, _groupId: 'regular' },
      { id: 'CLI-005', name: 'Epsilon Logistics', city: 'Miami', status: 'Pending', orders: 0, total: 0, _groupId: 'regular' },
    ],
    title: 'Customers',
    groups: [
      { id: 'vip', label: 'VIP Customers', color: '#00c875' },
      { id: 'regular', label: 'Regular Customers', color: '#579bfc' },
    ],
  },
}

/** Timeline bar column showing date ranges. */
export const WithTimeline: Story = {
  name: 'With Timeline',
  args: {
    columns: [
      { id: 'id', label: 'ID', type: 'text' as const, width: 80 },
      { id: 'task', label: 'Task', type: 'text' as const, width: 200 },
      { id: 'assignee', label: 'Assignee', type: 'person' as const, width: 120 },
      { id: 'timeline', label: 'Timeline', type: 'timeline' as const, width: 200 },
      { id: 'cost', label: 'Cost', type: 'currency' as const, width: 120, currencyCode: 'BRL' },
    ],
    rows: [
      { id: 'P-001', task: 'Phase 1 Planning', assignee: 'Ana Silva', timeline: '2026-03-01|2026-03-07', cost: 5000 },
      { id: 'P-002', task: 'Development Sprint', assignee: 'Carlos Mendes, Pedro Costa', timeline: '2026-03-08|2026-03-28', cost: 25000 },
      { id: 'P-003', task: 'QA Testing', assignee: 'Maria Souza', timeline: '2026-03-29|2026-04-05', cost: 8000 },
      { id: 'P-004', task: 'Deployment', assignee: 'Lucas Oliveira', timeline: '2026-04-06|2026-04-08', cost: 3000 },
    ],
    title: 'Project Timeline',
  },
}

/** Empty grid with skeleton loading animation. */
export const SkeletonLoading: Story = {
  name: 'Skeleton Loading',
  args: {
    columns: mockColumns,
    rows: [],
    title: 'Loading Data...',
  },
}

/** Click column headers to sort. Click again to toggle direction. Click a third time to remove. */
export const WithSort: Story = {
  name: 'With Sort',
  args: {
    columns: mockColumns,
    rows: largeRows,
    title: 'Customers (click headers to sort)',
  },
}

/** Right-click or click column headers to open the column menu with sort, hide, rename, and delete options. */
export const WithColumnMenu: Story = {
  name: 'With Column Menu',
  args: {
    columns: mondayColumns,
    rows: mondayRows,
    title: 'Project Tasks',
    groups: mondayGroups,
  },
}

/** Drag column header borders to resize columns. */
export const WithColumnResize: Story = {
  name: 'With Column Resize',
  args: {
    columns: mockColumns,
    rows: mockRows,
    title: 'Customers (drag header borders to resize)',
  },
}

/** All 17 cell types in a single grid. */
export const AllCellTypes: Story = {
  name: 'All Cell Types',
  args: {
    columns: [
      { id: 'id', label: 'ID', type: 'text' as const, width: 80 },
      { id: 'name', label: 'Name', type: 'text' as const, width: 160 },
      { id: 'count', label: 'Count', type: 'number' as const, width: 100 },
      { id: 'tag', label: 'Tag', type: 'badge' as const, width: 100 },
      {
        id: 'status', label: 'Status', type: 'status' as const, width: 130,
        statusColors: { 'Done': '#00c875', 'In Progress': '#fdab3d', 'Stuck': '#e2445c' },
      },
      { id: 'owner', label: 'Owner', type: 'person' as const, width: 120 },
      { id: 'budget', label: 'Budget', type: 'currency' as const, width: 120, currencyCode: 'USD' },
      { id: 'timeline', label: 'Timeline', type: 'timeline' as const, width: 180 },
      { id: 'priority', label: 'Priority', type: 'priority' as const, width: 120 },
      { id: 'active', label: 'Active', type: 'checkbox' as const, width: 70 },
      {
        id: 'category', label: 'Category', type: 'select' as const, width: 130,
        options: [
          { value: 'design', label: 'Design', color: '#8b5cf6' },
          { value: 'dev', label: 'Development', color: '#3b82f6' },
          { value: 'qa', label: 'QA', color: '#f59e0b' },
        ],
      },
      {
        id: 'tags', label: 'Tags', type: 'multiselect' as const, width: 200,
        options: [
          { value: 'urgent', label: 'Urgent', color: '#dc2626' },
          { value: 'frontend', label: 'Frontend', color: '#2563eb' },
          { value: 'backend', label: 'Backend', color: '#16a34a' },
        ],
      },
      { id: 'email', label: 'Email', type: 'email' as const, width: 200 },
      { id: 'website', label: 'Website', type: 'url' as const, width: 180 },
      { id: 'phone', label: 'Phone', type: 'phone' as const, width: 140 },
      { id: 'parent', label: 'Parent', type: 'relationship' as const, width: 140 },
      { id: 'summary', label: 'AI Summary', type: 'ai' as const, width: 200 },
    ],
    rows: [
      {
        id: 'REC-001', name: 'Alpha Project', count: 42, tag: 'Active', status: 'Done',
        owner: 'Ana Silva', budget: 15000, timeline: '2026-03-01|2026-03-20', priority: 'High',
        active: true, category: 'design', tags: 'urgent,frontend',
        email: 'ana@acme.com', website: 'https://acme.com', phone: '+55 11 99999-0001',
        parent: 'Portfolio A', summary: 'Project completed on schedule with all deliverables met.',
      },
      {
        id: 'REC-002', name: 'Beta Feature', count: 7, tag: 'Pending', status: 'In Progress',
        owner: 'Carlos Mendes', budget: 8500, timeline: '2026-03-10|2026-04-01', priority: 'Medium',
        active: true, category: 'dev', tags: 'backend',
        email: 'carlos@acme.com', website: 'https://beta.acme.com', phone: '+55 11 99999-0002',
        parent: 'Portfolio B', summary: '',
      },
      {
        id: 'REC-003', name: 'Gamma Fix', count: 1, tag: 'Inactive', status: 'Stuck',
        owner: 'Pedro Costa, Maria Souza', budget: 2000, timeline: '2026-03-05|2026-03-08', priority: 'Critical',
        active: false, category: 'qa', tags: 'urgent,backend,frontend',
        email: 'pedro@acme.com', website: '', phone: '+55 11 99999-0003',
        parent: '', summary: 'Blocked by dependency resolution.',
      },
    ],
    title: 'All Cell Types',
  },
}

/** Select rows to see the floating bulk actions bar at the bottom. */
export const WithBulkActions: Story = {
  name: 'With Bulk Actions',
  args: {
    columns: mockColumns,
    rows: mockRows,
    title: 'Customers',
    selectedRows: ['CLI-001', 'CLI-003'],
    onBulkDelete: fn(),
    onBulkDuplicate: fn(),
    onBulkExport: fn(),
  },
}

/** Double-click a row to open the detail side panel. */
export const WithDetailPanel: Story = {
  name: 'With Detail Panel',
  args: {
    columns: mondayColumns,
    rows: mondayRows,
    title: 'Project Tasks',
    groups: mondayGroups,
    onRowClick: fn(),
  },
}
