import React from 'react'

// ── Types ───────────────────────────────────────────────────────────────

export interface PreviewEntity {
  id: string
  name: string
  count: number
  active?: boolean
}

export interface PreviewColumn {
  label: string
  width?: string
}

export interface PreviewRow {
  id: string
  cells: React.ReactNode[]
  groupId: string
}

export interface PreviewGroup {
  id: string
  label: string
  color: string
}

export interface NichePreviewConfig {
  entities: PreviewEntity[]
  columns: PreviewColumn[]
  rows: PreviewRow[]
  groups: PreviewGroup[]
}

// ── Helpers ─────────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 600, color: '#fff', background: color, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function Av({ name, color }: { name: string; color: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2)
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

const C = ['#EA580C', '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#0891b2']

// Status shortcuts
const s = (l: string, c: string) => <Badge label={l} color={c} />
const a = (n: string, i: number) => <Av name={n} color={C[i % C.length]} />

// ── Niche-level defaults ────────────────────────────────────────────────

const NICHE_DEFAULTS: Record<string, NichePreviewConfig> = {
  // ─── RETAIL ─────────────────────────────────────────
  retail: {
    entities: [
      { id: 'products', name: 'Products', count: 248, active: true },
      { id: 'orders', name: 'Orders', count: 89 },
      { id: 'customers', name: 'Customers', count: 312 },
    ],
    columns: [
      { label: 'SKU', width: '12%' },
      { label: 'Product', width: '24%' },
      { label: 'Buyer', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '14%' },
    ],
    rows: [
      { id: 'P-001', groupId: 'active', cells: ['P-001', 'Running Shoes Pro', a('Ana Silva', 0), s('Available', '#00c875'), '$129.90'] },
      { id: 'P-002', groupId: 'active', cells: ['P-002', 'Sports Backpack', a('Carlos Mendes', 1), s('Low Stock', '#fdab3d'), '$79.90'] },
      { id: 'P-003', groupId: 'active', cells: ['P-003', 'Wireless Earbuds', a('Maria Costa', 2), s('Available', '#00c875'), '$199.90'] },
      { id: 'P-004', groupId: 'restock', cells: ['P-004', 'Yoga Mat Premium', a('Lucas Lima', 3), s('Out of Stock', '#e2445c'), '$59.90'] },
      { id: 'P-005', groupId: 'restock', cells: ['P-005', 'Water Bottle 1L', a('Pedro Santos', 4), s('Low Stock', '#fdab3d'), '$34.90'] },
    ],
    groups: [
      { id: 'active', label: 'In Stock', color: '#579bfc' },
      { id: 'restock', label: 'Restocking', color: '#a25ddc' },
    ],
  },

  // ─── FOOD & BEVERAGE ────────────────────────────────
  'food-beverage': {
    entities: [
      { id: 'batches', name: 'Batches', count: 56, active: true },
      { id: 'ingredients', name: 'Ingredients', count: 134 },
      { id: 'recipes', name: 'Recipes', count: 28 },
    ],
    columns: [
      { label: 'Batch', width: '12%' },
      { label: 'Product', width: '26%' },
      { label: 'Responsible', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'B-001', groupId: 'production', cells: ['B-001', 'Organic Juice 500ml', a('Fernando Souza', 0), s('In Progress', '#fdab3d')] },
      { id: 'B-002', groupId: 'production', cells: ['B-002', 'Granola Mix 250g', a('Juliana Rocha', 1), s('Done', '#00c875')] },
      { id: 'B-003', groupId: 'production', cells: ['B-003', 'Protein Bar 60g', a('Rafael Alves', 2), s('Stuck', '#e2445c')] },
      { id: 'B-004', groupId: 'qa', cells: ['B-004', 'Kombucha 350ml', a('Camila Nunes', 3), s('QA', '#579bfc')] },
    ],
    groups: [
      { id: 'production', label: 'Active Batches', color: '#00c875' },
      { id: 'qa', label: 'Pending QA', color: '#579bfc' },
    ],
  },

  // ─── PROFESSIONAL SERVICES ──────────────────────────
  services: {
    entities: [
      { id: 'projects', name: 'Projects', count: 18, active: true },
      { id: 'clients', name: 'Clients', count: 42 },
      { id: 'contracts', name: 'Contracts', count: 31 },
    ],
    columns: [
      { label: 'Code', width: '12%' },
      { label: 'Project', width: '28%' },
      { label: 'Manager', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'PRJ-01', groupId: 'active', cells: ['PRJ-01', 'ERP Implementation', a('Ricardo Almeida', 0), s('Active', '#00c875')] },
      { id: 'PRJ-02', groupId: 'active', cells: ['PRJ-02', 'Tax Advisory 2026', a('Paula Ferreira', 1), s('Active', '#00c875')] },
      { id: 'PRJ-03', groupId: 'active', cells: ['PRJ-03', 'Marketing Audit', a('Bruno Costa', 2), s('On Hold', '#fdab3d')] },
      { id: 'PRJ-04', groupId: 'done', cells: ['PRJ-04', 'IT Infrastructure', a('Fernanda Rocha', 3), s('Completed', '#579bfc')] },
    ],
    groups: [
      { id: 'active', label: 'Active Projects', color: '#00c875' },
      { id: 'done', label: 'Completed', color: '#579bfc' },
    ],
  },

  // ─── HEALTHCARE ─────────────────────────────────────
  healthcare: {
    entities: [
      { id: 'patients', name: 'Patients', count: 524, active: true },
      { id: 'appointments', name: 'Appointments', count: 87 },
      { id: 'treatments', name: 'Treatments', count: 43 },
    ],
    columns: [
      { label: 'ID', width: '12%' },
      { label: 'Patient', width: '24%' },
      { label: 'Doctor', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Date', width: '14%' },
    ],
    rows: [
      { id: 'PT-001', groupId: 'today', cells: ['PT-001', 'Mariana Oliveira', a('Dr. Renato', 0), s('Checked In', '#00c875'), '09:00'] },
      { id: 'PT-002', groupId: 'today', cells: ['PT-002', 'Carlos Eduardo', a('Dra. Beatriz', 1), s('Waiting', '#fdab3d'), '09:30'] },
      { id: 'PT-003', groupId: 'today', cells: ['PT-003', 'Lucia Santos', a('Dr. Renato', 0), s('In Progress', '#579bfc'), '10:00'] },
      { id: 'PT-004', groupId: 'upcoming', cells: ['PT-004', 'Roberto Dias', a('Dra. Paula', 3), s('Scheduled', '#a25ddc'), '14:00'] },
    ],
    groups: [
      { id: 'today', label: 'Today', color: '#00c875' },
      { id: 'upcoming', label: 'Upcoming', color: '#a25ddc' },
    ],
  },

  // ─── EDUCATION ──────────────────────────────────────
  education: {
    entities: [
      { id: 'students', name: 'Students', count: 380, active: true },
      { id: 'courses', name: 'Courses', count: 24 },
      { id: 'enrollments', name: 'Enrollments', count: 612 },
    ],
    columns: [
      { label: 'ID', width: '12%' },
      { label: 'Student', width: '24%' },
      { label: 'Instructor', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Grade', width: '14%' },
    ],
    rows: [
      { id: 'ST-001', groupId: 'active', cells: ['ST-001', 'Gabriel Martins', a('Prof. Clara', 0), s('Enrolled', '#00c875'), 'A'] },
      { id: 'ST-002', groupId: 'active', cells: ['ST-002', 'Isabela Ferreira', a('Prof. Marcos', 1), s('Enrolled', '#00c875'), 'B+'] },
      { id: 'ST-003', groupId: 'active', cells: ['ST-003', 'Thiago Souza', a('Prof. Clara', 0), s('At Risk', '#e2445c'), 'C'] },
      { id: 'ST-004', groupId: 'graduated', cells: ['ST-004', 'Larissa Costa', a('Prof. Ana', 3), s('Graduated', '#579bfc'), 'A+'] },
    ],
    groups: [
      { id: 'active', label: 'Active Students', color: '#00c875' },
      { id: 'graduated', label: 'Graduated', color: '#579bfc' },
    ],
  },

  // ─── MANUFACTURING ──────────────────────────────────
  manufacturing: {
    entities: [
      { id: 'work-orders', name: 'Work Orders', count: 67, active: true },
      { id: 'materials', name: 'Materials', count: 245 },
      { id: 'equipment', name: 'Equipment', count: 38 },
    ],
    columns: [
      { label: 'WO#', width: '12%' },
      { label: 'Product', width: '24%' },
      { label: 'Operator', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Qty', width: '14%' },
    ],
    rows: [
      { id: 'WO-101', groupId: 'production', cells: ['WO-101', 'Steel Bracket A', a('Jose Ribeiro', 0), s('Running', '#00c875'), '500'] },
      { id: 'WO-102', groupId: 'production', cells: ['WO-102', 'Plastic Housing B', a('Andre Lima', 1), s('Running', '#00c875'), '1200'] },
      { id: 'WO-103', groupId: 'production', cells: ['WO-103', 'Circuit Board v3', a('Marcos Vieira', 2), s('Delayed', '#e2445c'), '300'] },
      { id: 'WO-104', groupId: 'quality', cells: ['WO-104', 'Motor Assembly', a('Patricia Nunes', 3), s('QC Hold', '#fdab3d'), '150'] },
    ],
    groups: [
      { id: 'production', label: 'In Production', color: '#00c875' },
      { id: 'quality', label: 'Quality Check', color: '#fdab3d' },
    ],
  },

  // ─── CONSTRUCTION ───────────────────────────────────
  construction: {
    entities: [
      { id: 'projects', name: 'Projects', count: 12, active: true },
      { id: 'tasks', name: 'Tasks', count: 156 },
      { id: 'suppliers', name: 'Suppliers', count: 48 },
    ],
    columns: [
      { label: 'Code', width: '12%' },
      { label: 'Project', width: '26%' },
      { label: 'Engineer', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: '%', width: '10%' },
    ],
    rows: [
      { id: 'OB-01', groupId: 'active', cells: ['OB-01', 'Residencial Vila Nova', a('Eng. Marcos', 0), s('On Track', '#00c875'), '72%'] },
      { id: 'OB-02', groupId: 'active', cells: ['OB-02', 'Galpao Industrial SP', a('Eng. Renata', 1), s('On Track', '#00c875'), '45%'] },
      { id: 'OB-03', groupId: 'active', cells: ['OB-03', 'Reforma Ed. Central', a('Eng. Felipe', 2), s('Delayed', '#e2445c'), '28%'] },
      { id: 'OB-04', groupId: 'done', cells: ['OB-04', 'Ponte Rio Azul', a('Eng. Carla', 3), s('Delivered', '#579bfc'), '100%'] },
    ],
    groups: [
      { id: 'active', label: 'Active Sites', color: '#00c875' },
      { id: 'done', label: 'Delivered', color: '#579bfc' },
    ],
  },

  // ─── LOGISTICS ──────────────────────────────────────
  logistics: {
    entities: [
      { id: 'shipments', name: 'Shipments', count: 194, active: true },
      { id: 'vehicles', name: 'Vehicles', count: 32 },
      { id: 'warehouses', name: 'Warehouses', count: 5 },
    ],
    columns: [
      { label: 'Track#', width: '14%' },
      { label: 'Route', width: '24%' },
      { label: 'Driver', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'ETA', width: '12%' },
    ],
    rows: [
      { id: 'SH-401', groupId: 'transit', cells: ['SH-401', 'SP → RJ (Rodovia)', a('Diego Rocha', 0), s('In Transit', '#579bfc'), '14:30'] },
      { id: 'SH-402', groupId: 'transit', cells: ['SH-402', 'SP → BH (Fernao Dias)', a('Roberto Alves', 1), s('In Transit', '#579bfc'), '18:00'] },
      { id: 'SH-403', groupId: 'transit', cells: ['SH-403', 'RJ → Vitoria', a('Marcos Silva', 2), s('Delayed', '#e2445c'), '22:00'] },
      { id: 'SH-404', groupId: 'delivered', cells: ['SH-404', 'SP → Campinas', a('Felipe Costa', 3), s('Delivered', '#00c875'), 'Done'] },
    ],
    groups: [
      { id: 'transit', label: 'In Transit', color: '#579bfc' },
      { id: 'delivered', label: 'Delivered', color: '#00c875' },
    ],
  },

  // ─── TECHNOLOGY ─────────────────────────────────────
  technology: {
    entities: [
      { id: 'issues', name: 'Issues', count: 143, active: true },
      { id: 'sprints', name: 'Sprints', count: 12 },
      { id: 'releases', name: 'Releases', count: 8 },
    ],
    columns: [
      { label: 'ID', width: '12%' },
      { label: 'Issue', width: '26%' },
      { label: 'Assignee', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Priority', width: '12%' },
    ],
    rows: [
      { id: 'RUN-42', groupId: 'sprint', cells: ['RUN-42', 'Payment gateway timeout', a('Lucas Dev', 0), s('In Review', '#579bfc'), s('High', '#e2445c')] },
      { id: 'RUN-43', groupId: 'sprint', cells: ['RUN-43', 'Dashboard SSR cache', a('Ana Eng', 1), s('In Progress', '#fdab3d'), s('Medium', '#fdab3d')] },
      { id: 'RUN-44', groupId: 'sprint', cells: ['RUN-44', 'Auth token refresh', a('Pedro Ops', 2), s('Done', '#00c875'), s('High', '#e2445c')] },
      { id: 'RUN-45', groupId: 'backlog', cells: ['RUN-45', 'Dark mode support', a('Julia UI', 3), s('Backlog', '#a25ddc'), s('Low', '#00c875')] },
    ],
    groups: [
      { id: 'sprint', label: 'Sprint 12', color: '#579bfc' },
      { id: 'backlog', label: 'Backlog', color: '#a25ddc' },
    ],
  },

  // ─── HOSPITALITY ────────────────────────────────────
  hospitality: {
    entities: [
      { id: 'reservations', name: 'Reservations', count: 86, active: true },
      { id: 'rooms', name: 'Rooms', count: 45 },
      { id: 'guests', name: 'Guests', count: 312 },
    ],
    columns: [
      { label: 'Res#', width: '12%' },
      { label: 'Guest', width: '24%' },
      { label: 'Concierge', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Room', width: '12%' },
    ],
    rows: [
      { id: 'RS-110', groupId: 'checkin', cells: ['RS-110', 'Joao Pereira', a('Maria Staff', 0), s('Checked In', '#00c875'), '301'] },
      { id: 'RS-111', groupId: 'checkin', cells: ['RS-111', 'Elena Torres', a('Roberto Staff', 1), s('Arriving', '#fdab3d'), '205'] },
      { id: 'RS-112', groupId: 'checkin', cells: ['RS-112', 'Michael Brown', a('Ana Staff', 2), s('Checked In', '#00c875'), '412'] },
      { id: 'RS-113', groupId: 'checkout', cells: ['RS-113', 'Sofia Lima', a('Carlos Staff', 3), s('Checkout', '#579bfc'), '108'] },
    ],
    groups: [
      { id: 'checkin', label: 'Current Guests', color: '#00c875' },
      { id: 'checkout', label: 'Checking Out', color: '#579bfc' },
    ],
  },

  // ─── AGRICULTURE ────────────────────────────────────
  agriculture: {
    entities: [
      { id: 'plots', name: 'Plots', count: 24, active: true },
      { id: 'harvests', name: 'Harvests', count: 36 },
      { id: 'inventory', name: 'Inventory', count: 128 },
    ],
    columns: [
      { label: 'Plot', width: '12%' },
      { label: 'Crop', width: '24%' },
      { label: 'Technician', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Area', width: '14%' },
    ],
    rows: [
      { id: 'PLT-A1', groupId: 'growing', cells: ['PLT-A1', 'Soybean (Safra 26)', a('Eng. Rubens', 0), s('Growing', '#00c875'), '120 ha'] },
      { id: 'PLT-A2', groupId: 'growing', cells: ['PLT-A2', 'Corn (2nd crop)', a('Eng. Lucia', 1), s('Growing', '#00c875'), '80 ha'] },
      { id: 'PLT-B1', groupId: 'growing', cells: ['PLT-B1', 'Cotton', a('Eng. Marcos', 2), s('Pest Alert', '#e2445c'), '200 ha'] },
      { id: 'PLT-C1', groupId: 'harvest', cells: ['PLT-C1', 'Coffee (Arabica)', a('Eng. Helena', 3), s('Harvesting', '#579bfc'), '50 ha'] },
    ],
    groups: [
      { id: 'growing', label: 'In Season', color: '#00c875' },
      { id: 'harvest', label: 'Harvest Ready', color: '#579bfc' },
    ],
  },
}

// ── Sub-niche overrides ─────────────────────────────────────────────────
// Each overrides the niche default with more specific entities/data.

const SUB_NICHE_CONFIGS: Record<string, NichePreviewConfig> = {
  // ── Retail sub-niches ────────────────────
  clothing: {
    entities: [
      { id: 'items', name: 'Items', count: 312, active: true },
      { id: 'collections', name: 'Collections', count: 8 },
      { id: 'orders', name: 'Orders', count: 145 },
    ],
    columns: [
      { label: 'SKU', width: '12%' },
      { label: 'Item', width: '24%' },
      { label: 'Buyer', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '14%' },
    ],
    rows: [
      { id: 'CLT-01', groupId: 'active', cells: ['CLT-01', 'Vestido Floral GG', a('Marina Moda', 0), s('Available', '#00c875'), 'R$189'] },
      { id: 'CLT-02', groupId: 'active', cells: ['CLT-02', 'Blazer Slim Fit M', a('Andre Estilo', 1), s('Available', '#00c875'), 'R$329'] },
      { id: 'CLT-03', groupId: 'active', cells: ['CLT-03', 'Tenis Casual 42', a('Lucia Sales', 2), s('Low Stock', '#fdab3d'), 'R$249'] },
      { id: 'CLT-04', groupId: 'restock', cells: ['CLT-04', 'Jaqueta Jeans P', a('Pedro Compras', 3), s('Out of Stock', '#e2445c'), 'R$199'] },
    ],
    groups: [
      { id: 'active', label: 'In Stock', color: '#579bfc' },
      { id: 'restock', label: 'Restocking', color: '#a25ddc' },
    ],
  },
  electronics: {
    entities: [
      { id: 'products', name: 'Products', count: 186, active: true },
      { id: 'warranties', name: 'Warranties', count: 320 },
      { id: 'repairs', name: 'Repairs', count: 42 },
    ],
    columns: [
      { label: 'SKU', width: '12%' },
      { label: 'Product', width: '24%' },
      { label: 'Buyer', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '14%' },
    ],
    rows: [
      { id: 'EL-01', groupId: 'active', cells: ['EL-01', 'Notebook Pro 15"', a('Ana Tech', 0), s('Available', '#00c875'), 'R$4.999'] },
      { id: 'EL-02', groupId: 'active', cells: ['EL-02', 'Smartphone X12', a('Carlos Elet', 1), s('Available', '#00c875'), 'R$2.399'] },
      { id: 'EL-03', groupId: 'active', cells: ['EL-03', 'TV 55" 4K', a('Marcos Digital', 2), s('Low Stock', '#fdab3d'), 'R$3.199'] },
      { id: 'EL-04', groupId: 'restock', cells: ['EL-04', 'Fone Bluetooth', a('Julia Audio', 3), s('Out of Stock', '#e2445c'), 'R$349'] },
    ],
    groups: [
      { id: 'active', label: 'In Stock', color: '#579bfc' },
      { id: 'restock', label: 'Restocking', color: '#a25ddc' },
    ],
  },
  grocery: {
    entities: [
      { id: 'products', name: 'Products', count: 1420, active: true },
      { id: 'suppliers', name: 'Suppliers', count: 86 },
      { id: 'promotions', name: 'Promotions', count: 12 },
    ],
    columns: [
      { label: 'EAN', width: '14%' },
      { label: 'Product', width: '24%' },
      { label: 'Buyer', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '12%' },
    ],
    rows: [
      { id: 'GR-01', groupId: 'active', cells: ['7891234', 'Arroz Integral 5kg', a('Marcos Compras', 0), s('OK', '#00c875'), 'R$28.90'] },
      { id: 'GR-02', groupId: 'active', cells: ['7891567', 'Azeite Extra Virgem', a('Ana Estoque', 1), s('OK', '#00c875'), 'R$42.50'] },
      { id: 'GR-03', groupId: 'active', cells: ['7892345', 'Cafe Premium 500g', a('Pedro Varejo', 2), s('Low Stock', '#fdab3d'), 'R$34.90'] },
      { id: 'GR-04', groupId: 'promo', cells: ['7893456', 'Cerveja Artesanal 6pk', a('Julia Promo', 3), s('On Sale', '#a25ddc'), 'R$59.90'] },
    ],
    groups: [
      { id: 'active', label: 'Regular Stock', color: '#00c875' },
      { id: 'promo', label: 'Promotions', color: '#a25ddc' },
    ],
  },
  furniture: {
    entities: [
      { id: 'catalog', name: 'Catalog', count: 156, active: true },
      { id: 'orders', name: 'Orders', count: 34 },
      { id: 'showrooms', name: 'Showrooms', count: 3 },
    ],
    columns: [
      { label: 'Ref', width: '12%' },
      { label: 'Item', width: '26%' },
      { label: 'Designer', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '14%' },
    ],
    rows: [
      { id: 'FN-01', groupId: 'active', cells: ['FN-01', 'Sofa Retrátil 3L', a('Arq. Paula', 0), s('Available', '#00c875'), 'R$3.890'] },
      { id: 'FN-02', groupId: 'active', cells: ['FN-02', 'Mesa Jantar 6 Lug', a('Des. Ricardo', 1), s('Available', '#00c875'), 'R$2.450'] },
      { id: 'FN-03', groupId: 'active', cells: ['FN-03', 'Estante Industrial', a('Des. Camila', 2), s('Made to Order', '#579bfc'), 'R$1.890'] },
      { id: 'FN-04', groupId: 'custom', cells: ['FN-04', 'Cozinha Planejada', a('Arq. Marcos', 3), s('In Production', '#fdab3d'), 'R$12.500'] },
    ],
    groups: [
      { id: 'active', label: 'Catalog', color: '#00c875' },
      { id: 'custom', label: 'Custom Orders', color: '#fdab3d' },
    ],
  },
  sports: {
    entities: [
      { id: 'products', name: 'Products', count: 420, active: true },
      { id: 'brands', name: 'Brands', count: 38 },
      { id: 'orders', name: 'Orders', count: 92 },
    ],
    columns: [
      { label: 'SKU', width: '12%' },
      { label: 'Product', width: '24%' },
      { label: 'Buyer', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '14%' },
    ],
    rows: [
      { id: 'SP-01', groupId: 'active', cells: ['SP-01', 'Bicicleta MTB 29"', a('Felipe Esporte', 0), s('Available', '#00c875'), 'R$2.890'] },
      { id: 'SP-02', groupId: 'active', cells: ['SP-02', 'Barraca Camping 4P', a('Ana Outdoor', 1), s('Available', '#00c875'), 'R$590'] },
      { id: 'SP-03', groupId: 'active', cells: ['SP-03', 'Luva de Box Pro', a('Diego Fight', 2), s('Low Stock', '#fdab3d'), 'R$189'] },
      { id: 'SP-04', groupId: 'restock', cells: ['SP-04', 'Prancha de Surf 6\'2', a('Marcos Wave', 3), s('Out of Stock', '#e2445c'), 'R$1.350'] },
    ],
    groups: [
      { id: 'active', label: 'In Stock', color: '#579bfc' },
      { id: 'restock', label: 'Restocking', color: '#a25ddc' },
    ],
  },
  beauty: {
    entities: [
      { id: 'products', name: 'Products', count: 289, active: true },
      { id: 'clients', name: 'Clients', count: 156 },
      { id: 'appointments', name: 'Appointments', count: 43 },
    ],
    columns: [
      { label: 'Code', width: '12%' },
      { label: 'Product', width: '24%' },
      { label: 'Manager', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '14%' },
    ],
    rows: [
      { id: 'BT-01', groupId: 'active', cells: ['BT-01', 'Serum Facial Retinol', a('Dra. Camila', 0), s('Available', '#00c875'), 'R$189'] },
      { id: 'BT-02', groupId: 'active', cells: ['BT-02', 'Kit Capilar Repair', a('Paula Cosm', 1), s('Available', '#00c875'), 'R$129'] },
      { id: 'BT-03', groupId: 'active', cells: ['BT-03', 'Paleta de Sombras', a('Julia Makeup', 2), s('Best Seller', '#a25ddc'), 'R$79'] },
      { id: 'BT-04', groupId: 'restock', cells: ['BT-04', 'Perfume Exclusive 50ml', a('Ana Fragr', 3), s('Out of Stock', '#e2445c'), 'R$299'] },
    ],
    groups: [
      { id: 'active', label: 'In Stock', color: '#00c875' },
      { id: 'restock', label: 'Restocking', color: '#a25ddc' },
    ],
  },
  pet: {
    entities: [
      { id: 'products', name: 'Products', count: 345, active: true },
      { id: 'customers', name: 'Customers', count: 210 },
      { id: 'services', name: 'Services', count: 18 },
    ],
    columns: [
      { label: 'SKU', width: '12%' },
      { label: 'Product', width: '24%' },
      { label: 'Buyer', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '14%' },
    ],
    rows: [
      { id: 'PT-01', groupId: 'active', cells: ['PT-01', 'Racao Premium 15kg', a('Marcos Pet', 0), s('Available', '#00c875'), 'R$189'] },
      { id: 'PT-02', groupId: 'active', cells: ['PT-02', 'Cama Ortopedica G', a('Ana Animal', 1), s('Available', '#00c875'), 'R$249'] },
      { id: 'PT-03', groupId: 'active', cells: ['PT-03', 'Brinquedo Kong XL', a('Pedro Pet', 2), s('Low Stock', '#fdab3d'), 'R$89'] },
      { id: 'PT-04', groupId: 'restock', cells: ['PT-04', 'Shampoo Hipoalerg.', a('Julia Vet', 3), s('Out of Stock', '#e2445c'), 'R$45'] },
    ],
    groups: [
      { id: 'active', label: 'In Stock', color: '#00c875' },
      { id: 'restock', label: 'Restocking', color: '#a25ddc' },
    ],
  },
  books: {
    entities: [
      { id: 'catalog', name: 'Catalog', count: 890, active: true },
      { id: 'orders', name: 'Orders', count: 67 },
      { id: 'authors', name: 'Authors', count: 234 },
    ],
    columns: [
      { label: 'ISBN', width: '14%' },
      { label: 'Title', width: '24%' },
      { label: 'Curator', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '12%' },
    ],
    rows: [
      { id: 'BK-01', groupId: 'active', cells: ['978-85-01', 'Dom Casmurro', a('Ana Letras', 0), s('Available', '#00c875'), 'R$42'] },
      { id: 'BK-02', groupId: 'active', cells: ['978-85-02', 'O Alquimista', a('Marcos Lit', 1), s('Best Seller', '#a25ddc'), 'R$39'] },
      { id: 'BK-03', groupId: 'active', cells: ['978-85-03', 'Sketchbook A4 180g', a('Julia Art', 2), s('Available', '#00c875'), 'R$68'] },
      { id: 'BK-04', groupId: 'restock', cells: ['978-85-04', 'Caneta Nankin Kit', a('Pedro Pap', 3), s('Low Stock', '#fdab3d'), 'R$89'] },
    ],
    groups: [
      { id: 'active', label: 'In Stock', color: '#00c875' },
      { id: 'restock', label: 'Restocking', color: '#a25ddc' },
    ],
  },

  // ── Food & Beverage sub-niches ───────────
  restaurant: {
    entities: [
      { id: 'menu', name: 'Menu Items', count: 64, active: true },
      { id: 'reservations', name: 'Reservations', count: 28 },
      { id: 'suppliers', name: 'Suppliers', count: 15 },
    ],
    columns: [
      { label: 'Code', width: '12%' },
      { label: 'Dish', width: '26%' },
      { label: 'Chef', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '12%' },
    ],
    rows: [
      { id: 'MN-01', groupId: 'active', cells: ['MN-01', 'Picanha Grelhada', a('Chef Ricardo', 0), s('Active', '#00c875'), 'R$89'] },
      { id: 'MN-02', groupId: 'active', cells: ['MN-02', 'Risoto de Cogumelos', a('Chef Ana', 1), s('Active', '#00c875'), 'R$72'] },
      { id: 'MN-03', groupId: 'active', cells: ['MN-03', 'Salmao ao Molho', a('Chef Ricardo', 0), s('Seasonal', '#a25ddc'), 'R$95'] },
      { id: 'MN-04', groupId: 'off', cells: ['MN-04', 'Feijoada Completa', a('Chef Marcos', 3), s('Sat Only', '#fdab3d'), 'R$68'] },
    ],
    groups: [
      { id: 'active', label: 'Daily Menu', color: '#00c875' },
      { id: 'off', label: 'Special Days', color: '#fdab3d' },
    ],
  },
  cafe: {
    entities: [
      { id: 'menu', name: 'Menu', count: 42, active: true },
      { id: 'ingredients', name: 'Ingredients', count: 86 },
      { id: 'orders', name: 'Orders', count: 234 },
    ],
    columns: [
      { label: 'Item', width: '12%' },
      { label: 'Product', width: '26%' },
      { label: 'Barista', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '12%' },
    ],
    rows: [
      { id: 'CF-01', groupId: 'drinks', cells: ['CF-01', 'Cappuccino Especial', a('Barista Leo', 0), s('Available', '#00c875'), 'R$14'] },
      { id: 'CF-02', groupId: 'drinks', cells: ['CF-02', 'Cold Brew 500ml', a('Barista Julia', 1), s('Available', '#00c875'), 'R$18'] },
      { id: 'CF-03', groupId: 'food', cells: ['CF-03', 'Croissant Chocolate', a('Padeira Ana', 2), s('Fresh', '#a25ddc'), 'R$12'] },
      { id: 'CF-04', groupId: 'food', cells: ['CF-04', 'Bolo de Cenoura', a('Padeira Ana', 2), s('Low Stock', '#fdab3d'), 'R$9'] },
    ],
    groups: [
      { id: 'drinks', label: 'Drinks', color: '#00c875' },
      { id: 'food', label: 'Bakery', color: '#a25ddc' },
    ],
  },
  bar: {
    entities: [
      { id: 'menu', name: 'Drinks Menu', count: 78, active: true },
      { id: 'events', name: 'Events', count: 12 },
      { id: 'suppliers', name: 'Suppliers', count: 22 },
    ],
    columns: [
      { label: 'Code', width: '12%' },
      { label: 'Drink', width: '26%' },
      { label: 'Bartender', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '12%' },
    ],
    rows: [
      { id: 'DR-01', groupId: 'cocktails', cells: ['DR-01', 'Caipirinha Premium', a('Mixol. Bruno', 0), s('Active', '#00c875'), 'R$32'] },
      { id: 'DR-02', groupId: 'cocktails', cells: ['DR-02', 'Negroni Classico', a('Mixol. Ana', 1), s('Active', '#00c875'), 'R$38'] },
      { id: 'DR-03', groupId: 'cocktails', cells: ['DR-03', 'Gin Tonica Especial', a('Mixol. Bruno', 0), s('Best Seller', '#a25ddc'), 'R$36'] },
      { id: 'DR-04', groupId: 'promo', cells: ['DR-04', 'Chopp Artesanal 500ml', a('Garcom Pedro', 3), s('Happy Hour', '#fdab3d'), 'R$18'] },
    ],
    groups: [
      { id: 'cocktails', label: 'Cocktails', color: '#00c875' },
      { id: 'promo', label: 'Promotions', color: '#fdab3d' },
    ],
  },
  catering: {
    entities: [
      { id: 'events', name: 'Events', count: 24, active: true },
      { id: 'menus', name: 'Menus', count: 18 },
      { id: 'clients', name: 'Clients', count: 56 },
    ],
    columns: [
      { label: 'Ref', width: '12%' },
      { label: 'Event', width: '26%' },
      { label: 'Chef', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Guests', width: '12%' },
    ],
    rows: [
      { id: 'EV-01', groupId: 'upcoming', cells: ['EV-01', 'Casamento Silva', a('Chef Paula', 0), s('Confirmed', '#00c875'), '180'] },
      { id: 'EV-02', groupId: 'upcoming', cells: ['EV-02', 'Corporate ABTech', a('Chef Ricardo', 1), s('Planning', '#fdab3d'), '250'] },
      { id: 'EV-03', groupId: 'upcoming', cells: ['EV-03', 'Aniversario 50 anos', a('Chef Ana', 2), s('Confirmed', '#00c875'), '80'] },
      { id: 'EV-04', groupId: 'done', cells: ['EV-04', 'Gala Beneficente', a('Chef Marcos', 3), s('Completed', '#579bfc'), '400'] },
    ],
    groups: [
      { id: 'upcoming', label: 'Upcoming Events', color: '#00c875' },
      { id: 'done', label: 'Completed', color: '#579bfc' },
    ],
  },
  'food-truck': {
    entities: [
      { id: 'menu', name: 'Menu', count: 18, active: true },
      { id: 'locations', name: 'Locations', count: 8 },
      { id: 'sales', name: 'Daily Sales', count: 342 },
    ],
    columns: [
      { label: 'Item', width: '12%' },
      { label: 'Product', width: '26%' },
      { label: 'Prep', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '12%' },
    ],
    rows: [
      { id: 'FT-01', groupId: 'active', cells: ['FT-01', 'Burger Artesanal', a('Chef Diego', 0), s('Available', '#00c875'), 'R$32'] },
      { id: 'FT-02', groupId: 'active', cells: ['FT-02', 'Tacos Mexicanos x3', a('Chef Maria', 1), s('Available', '#00c875'), 'R$28'] },
      { id: 'FT-03', groupId: 'active', cells: ['FT-03', 'Acai Bowl 500ml', a('Prep Julia', 2), s('Best Seller', '#a25ddc'), 'R$22'] },
      { id: 'FT-04', groupId: 'off', cells: ['FT-04', 'Crepe Doce Nutella', a('Chef Diego', 0), s('Sold Out', '#e2445c'), 'R$18'] },
    ],
    groups: [
      { id: 'active', label: 'Today\'s Menu', color: '#00c875' },
      { id: 'off', label: 'Sold Out', color: '#e2445c' },
    ],
  },
  delivery: {
    entities: [
      { id: 'menu', name: 'Menu', count: 34, active: true },
      { id: 'orders', name: 'Orders', count: 89 },
      { id: 'drivers', name: 'Drivers', count: 12 },
    ],
    columns: [
      { label: 'Order', width: '12%' },
      { label: 'Items', width: '26%' },
      { label: 'Driver', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'ETA', width: '12%' },
    ],
    rows: [
      { id: 'DL-01', groupId: 'active', cells: ['#4521', 'Marmita Fitness x2', a('Motoboy Leo', 0), s('Delivering', '#579bfc'), '15 min'] },
      { id: 'DL-02', groupId: 'active', cells: ['#4522', 'Salada Caesar + Suco', a('Motoboy Pedro', 1), s('Preparing', '#fdab3d'), '25 min'] },
      { id: 'DL-03', groupId: 'active', cells: ['#4523', 'Bowl Proteico GG', a('Motoboy Ana', 2), s('Preparing', '#fdab3d'), '30 min'] },
      { id: 'DL-04', groupId: 'done', cells: ['#4520', 'Wrap Frango + Combo', a('Motoboy Leo', 0), s('Delivered', '#00c875'), 'Done'] },
    ],
    groups: [
      { id: 'active', label: 'Active Orders', color: '#579bfc' },
      { id: 'done', label: 'Completed', color: '#00c875' },
    ],
  },
  brewery: {
    entities: [
      { id: 'beers', name: 'Beers', count: 18, active: true },
      { id: 'batches', name: 'Batches', count: 42 },
      { id: 'distribution', name: 'Distribution', count: 86 },
    ],
    columns: [
      { label: 'Batch', width: '12%' },
      { label: 'Beer', width: '26%' },
      { label: 'Brewer', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'IBU', width: '12%' },
    ],
    rows: [
      { id: 'BR-01', groupId: 'fermenting', cells: ['BR-01', 'IPA Tropical 600ml', a('Cervej. Bruno', 0), s('Fermenting', '#fdab3d'), '45'] },
      { id: 'BR-02', groupId: 'fermenting', cells: ['BR-02', 'Pilsen Artesanal', a('Cervej. Ana', 1), s('Fermenting', '#fdab3d'), '25'] },
      { id: 'BR-03', groupId: 'ready', cells: ['BR-03', 'Stout Chocolate', a('Cervej. Bruno', 0), s('Ready', '#00c875'), '38'] },
      { id: 'BR-04', groupId: 'ready', cells: ['BR-04', 'Weiss Banana Cravo', a('Cervej. Marcos', 3), s('Bottled', '#579bfc'), '15'] },
    ],
    groups: [
      { id: 'fermenting', label: 'Fermenting', color: '#fdab3d' },
      { id: 'ready', label: 'Ready', color: '#00c875' },
    ],
  },
  'food-production': {
    entities: [
      { id: 'batches', name: 'Batches', count: 56, active: true },
      { id: 'ingredients', name: 'Ingredients', count: 134 },
      { id: 'recipes', name: 'Recipes', count: 28 },
    ],
    columns: [
      { label: 'Batch', width: '12%' },
      { label: 'Product', width: '26%' },
      { label: 'Responsible', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'FP-01', groupId: 'production', cells: ['FP-01', 'Molho de Tomate 500g', a('Tech. Marcos', 0), s('In Progress', '#fdab3d')] },
      { id: 'FP-02', groupId: 'production', cells: ['FP-02', 'Geleia Artesanal 250g', a('Tech. Julia', 1), s('Done', '#00c875')] },
      { id: 'FP-03', groupId: 'production', cells: ['FP-03', 'Granola Premium 400g', a('Tech. Pedro', 2), s('In Progress', '#fdab3d')] },
      { id: 'FP-04', groupId: 'qa', cells: ['FP-04', 'Barra de Cereal 30g', a('QC Ana', 3), s('QA', '#579bfc')] },
    ],
    groups: [
      { id: 'production', label: 'In Production', color: '#00c875' },
      { id: 'qa', label: 'Quality Control', color: '#579bfc' },
    ],
  },

  // ── Professional Services sub-niches ─────
  consulting: {
    entities: [
      { id: 'engagements', name: 'Engagements', count: 14, active: true },
      { id: 'clients', name: 'Clients', count: 38 },
      { id: 'proposals', name: 'Proposals', count: 22 },
    ],
    columns: [
      { label: 'Ref', width: '12%' },
      { label: 'Engagement', width: '28%' },
      { label: 'Lead', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'ENG-01', groupId: 'active', cells: ['ENG-01', 'Digital Transformation', a('Sr. Almeida', 0), s('Active', '#00c875')] },
      { id: 'ENG-02', groupId: 'active', cells: ['ENG-02', 'Supply Chain Review', a('Dra. Paula', 1), s('Active', '#00c875')] },
      { id: 'ENG-03', groupId: 'active', cells: ['ENG-03', 'Cost Optimization', a('Sr. Bruno', 2), s('On Hold', '#fdab3d')] },
      { id: 'ENG-04', groupId: 'closed', cells: ['ENG-04', 'Market Entry Strategy', a('Dra. Carla', 3), s('Closed', '#579bfc')] },
    ],
    groups: [
      { id: 'active', label: 'Active Engagements', color: '#00c875' },
      { id: 'closed', label: 'Closed', color: '#579bfc' },
    ],
  },
  accounting: {
    entities: [
      { id: 'clients', name: 'Clients', count: 86, active: true },
      { id: 'obligations', name: 'Obligations', count: 142 },
      { id: 'invoices', name: 'Invoices', count: 234 },
    ],
    columns: [
      { label: 'CNPJ', width: '14%' },
      { label: 'Company', width: '26%' },
      { label: 'Accountant', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'CL-01', groupId: 'active', cells: ['12.345.678', 'Padaria Bom Gosto', a('Cont. Marcos', 0), s('Up to Date', '#00c875')] },
      { id: 'CL-02', groupId: 'active', cells: ['23.456.789', 'TechSoft Ltda', a('Cont. Ana', 1), s('Up to Date', '#00c875')] },
      { id: 'CL-03', groupId: 'active', cells: ['34.567.890', 'Loja do Joao ME', a('Cont. Pedro', 2), s('Pending Docs', '#fdab3d')] },
      { id: 'CL-04', groupId: 'alert', cells: ['45.678.901', 'Auto Pecas Silva', a('Cont. Julia', 3), s('Tax Alert', '#e2445c')] },
    ],
    groups: [
      { id: 'active', label: 'Active Clients', color: '#00c875' },
      { id: 'alert', label: 'Attention Needed', color: '#e2445c' },
    ],
  },
  legal: {
    entities: [
      { id: 'cases', name: 'Cases', count: 34, active: true },
      { id: 'clients', name: 'Clients', count: 62 },
      { id: 'documents', name: 'Documents', count: 580 },
    ],
    columns: [
      { label: 'Case#', width: '12%' },
      { label: 'Case', width: '28%' },
      { label: 'Attorney', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'CS-01', groupId: 'active', cells: ['CS-01', 'Contrato Societario', a('Adv. Renata', 0), s('In Progress', '#fdab3d')] },
      { id: 'CS-02', groupId: 'active', cells: ['CS-02', 'Acao Trabalhista', a('Adv. Felipe', 1), s('Discovery', '#579bfc')] },
      { id: 'CS-03', groupId: 'active', cells: ['CS-03', 'Due Diligence M&A', a('Adv. Carla', 2), s('Urgent', '#e2445c')] },
      { id: 'CS-04', groupId: 'closed', cells: ['CS-04', 'Registro de Marca', a('Adv. Bruno', 3), s('Closed', '#00c875')] },
    ],
    groups: [
      { id: 'active', label: 'Active Cases', color: '#579bfc' },
      { id: 'closed', label: 'Closed', color: '#00c875' },
    ],
  },
  marketing: {
    entities: [
      { id: 'campaigns', name: 'Campaigns', count: 22, active: true },
      { id: 'clients', name: 'Clients', count: 18 },
      { id: 'creatives', name: 'Creatives', count: 156 },
    ],
    columns: [
      { label: 'ID', width: '12%' },
      { label: 'Campaign', width: '28%' },
      { label: 'Manager', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'CP-01', groupId: 'active', cells: ['CP-01', 'Black Friday 2026', a('Mkt. Ana', 0), s('Running', '#00c875')] },
      { id: 'CP-02', groupId: 'active', cells: ['CP-02', 'Brand Relaunch', a('Mkt. Bruno', 1), s('Running', '#00c875')] },
      { id: 'CP-03', groupId: 'active', cells: ['CP-03', 'Social Media Q1', a('Mkt. Julia', 2), s('Paused', '#fdab3d')] },
      { id: 'CP-04', groupId: 'done', cells: ['CP-04', 'Product Launch X', a('Mkt. Pedro', 3), s('Completed', '#579bfc')] },
    ],
    groups: [
      { id: 'active', label: 'Active Campaigns', color: '#00c875' },
      { id: 'done', label: 'Completed', color: '#579bfc' },
    ],
  },
  'it-services': {
    entities: [
      { id: 'tickets', name: 'Tickets', count: 89, active: true },
      { id: 'clients', name: 'Clients', count: 34 },
      { id: 'contracts', name: 'SLAs', count: 28 },
    ],
    columns: [
      { label: 'Ticket', width: '12%' },
      { label: 'Issue', width: '28%' },
      { label: 'Tech', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'TK-01', groupId: 'open', cells: ['TK-301', 'Server Down (Client A)', a('Tech. Lucas', 0), s('Critical', '#e2445c')] },
      { id: 'TK-02', groupId: 'open', cells: ['TK-302', 'VPN Config Issue', a('Tech. Maria', 1), s('In Progress', '#fdab3d')] },
      { id: 'TK-03', groupId: 'open', cells: ['TK-303', 'Email Migration', a('Tech. Pedro', 2), s('Scheduled', '#579bfc')] },
      { id: 'TK-04', groupId: 'closed', cells: ['TK-300', 'Firewall Update', a('Tech. Ana', 3), s('Resolved', '#00c875')] },
    ],
    groups: [
      { id: 'open', label: 'Open Tickets', color: '#e2445c' },
      { id: 'closed', label: 'Resolved', color: '#00c875' },
    ],
  },
  'hr-services': {
    entities: [
      { id: 'candidates', name: 'Candidates', count: 124, active: true },
      { id: 'positions', name: 'Positions', count: 18 },
      { id: 'clients', name: 'Clients', count: 22 },
    ],
    columns: [
      { label: 'ID', width: '12%' },
      { label: 'Candidate', width: '26%' },
      { label: 'Recruiter', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'CD-01', groupId: 'pipeline', cells: ['CD-01', 'Mariana Alves', a('Rec. Julia', 0), s('Interview', '#579bfc')] },
      { id: 'CD-02', groupId: 'pipeline', cells: ['CD-02', 'Bruno Oliveira', a('Rec. Pedro', 1), s('Screening', '#fdab3d')] },
      { id: 'CD-03', groupId: 'pipeline', cells: ['CD-03', 'Ana Carolina Souza', a('Rec. Julia', 0), s('Offer Sent', '#a25ddc')] },
      { id: 'CD-04', groupId: 'placed', cells: ['CD-04', 'Felipe Costa', a('Rec. Ana', 3), s('Hired', '#00c875')] },
    ],
    groups: [
      { id: 'pipeline', label: 'Pipeline', color: '#579bfc' },
      { id: 'placed', label: 'Placed', color: '#00c875' },
    ],
  },
  architecture: {
    entities: [
      { id: 'projects', name: 'Projects', count: 16, active: true },
      { id: 'clients', name: 'Clients', count: 28 },
      { id: 'blueprints', name: 'Blueprints', count: 94 },
    ],
    columns: [
      { label: 'Ref', width: '12%' },
      { label: 'Project', width: '28%' },
      { label: 'Architect', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'ARQ-01', groupId: 'active', cells: ['ARQ-01', 'Casa de Praia 280m2', a('Arq. Paula', 0), s('Design', '#579bfc')] },
      { id: 'ARQ-02', groupId: 'active', cells: ['ARQ-02', 'Escritorio Cowork', a('Arq. Felipe', 1), s('In Review', '#fdab3d')] },
      { id: 'ARQ-03', groupId: 'active', cells: ['ARQ-03', 'Clinica Odonto', a('Arq. Carla', 2), s('Approved', '#00c875')] },
      { id: 'ARQ-04', groupId: 'done', cells: ['ARQ-04', 'Restaurante Italiano', a('Arq. Bruno', 3), s('Built', '#579bfc')] },
    ],
    groups: [
      { id: 'active', label: 'Active Projects', color: '#00c875' },
      { id: 'done', label: 'Delivered', color: '#579bfc' },
    ],
  },
  'real-estate': {
    entities: [
      { id: 'listings', name: 'Listings', count: 86, active: true },
      { id: 'clients', name: 'Clients', count: 124 },
      { id: 'contracts', name: 'Contracts', count: 42 },
    ],
    columns: [
      { label: 'Ref', width: '12%' },
      { label: 'Property', width: '26%' },
      { label: 'Agent', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '14%' },
    ],
    rows: [
      { id: 'IM-01', groupId: 'active', cells: ['IM-01', 'Apto 3Q Jardins SP', a('Corretor Ana', 0), s('Active', '#00c875'), 'R$1.2M'] },
      { id: 'IM-02', groupId: 'active', cells: ['IM-02', 'Casa Cond. Alphaville', a('Corretor Bruno', 1), s('Active', '#00c875'), 'R$2.8M'] },
      { id: 'IM-03', groupId: 'active', cells: ['IM-03', 'Sala Com. Faria Lima', a('Corretor Pedro', 2), s('Negotiating', '#fdab3d'), 'R$950K'] },
      { id: 'IM-04', groupId: 'sold', cells: ['IM-04', 'Cobertura Leblon RJ', a('Corretor Julia', 3), s('Sold', '#579bfc'), 'R$4.5M'] },
    ],
    groups: [
      { id: 'active', label: 'Active Listings', color: '#00c875' },
      { id: 'sold', label: 'Sold', color: '#579bfc' },
    ],
  },
  insurance: {
    entities: [
      { id: 'policies', name: 'Policies', count: 312, active: true },
      { id: 'claims', name: 'Claims', count: 28 },
      { id: 'clients', name: 'Clients', count: 186 },
    ],
    columns: [
      { label: 'Policy', width: '14%' },
      { label: 'Client', width: '24%' },
      { label: 'Agent', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'PL-01', groupId: 'active', cells: ['AP-12345', 'Maria Oliveira', a('Ag. Carlos', 0), s('Active', '#00c875')] },
      { id: 'PL-02', groupId: 'active', cells: ['VD-23456', 'Tech Solutions Ltd', a('Ag. Ana', 1), s('Active', '#00c875')] },
      { id: 'PL-03', groupId: 'active', cells: ['SV-34567', 'Roberto Dias', a('Ag. Pedro', 2), s('Renewal Due', '#fdab3d')] },
      { id: 'PL-04', groupId: 'claims', cells: ['AP-45678', 'Lucia Santos', a('Ag. Julia', 3), s('Claim Open', '#e2445c')] },
    ],
    groups: [
      { id: 'active', label: 'Active Policies', color: '#00c875' },
      { id: 'claims', label: 'Open Claims', color: '#e2445c' },
    ],
  },

  // ── Healthcare sub-niches ────────────────
  clinic: {
    entities: [
      { id: 'patients', name: 'Patients', count: 450, active: true },
      { id: 'appointments', name: 'Appointments', count: 62 },
      { id: 'exams', name: 'Exams', count: 128 },
    ],
    columns: [
      { label: 'ID', width: '12%' },
      { label: 'Patient', width: '24%' },
      { label: 'Doctor', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Time', width: '14%' },
    ],
    rows: [
      { id: 'PA-01', groupId: 'today', cells: ['PA-01', 'Ana Paula Souza', a('Dr. Renato', 0), s('Checked In', '#00c875'), '08:30'] },
      { id: 'PA-02', groupId: 'today', cells: ['PA-02', 'Pedro Henrique', a('Dra. Carla', 1), s('In Consult', '#579bfc'), '09:00'] },
      { id: 'PA-03', groupId: 'today', cells: ['PA-03', 'Fernanda Lima', a('Dr. Renato', 0), s('Waiting', '#fdab3d'), '09:30'] },
      { id: 'PA-04', groupId: 'upcoming', cells: ['PA-04', 'Roberto Carlos', a('Dra. Paula', 3), s('Scheduled', '#a25ddc'), '14:00'] },
    ],
    groups: [
      { id: 'today', label: 'Today', color: '#00c875' },
      { id: 'upcoming', label: 'Upcoming', color: '#a25ddc' },
    ],
  },
  dental: {
    entities: [
      { id: 'patients', name: 'Patients', count: 280, active: true },
      { id: 'treatments', name: 'Treatments', count: 86 },
      { id: 'lab-orders', name: 'Lab Orders', count: 34 },
    ],
    columns: [
      { label: 'ID', width: '12%' },
      { label: 'Patient', width: '24%' },
      { label: 'Dentist', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Procedure', width: '16%' },
    ],
    rows: [
      { id: 'DN-01', groupId: 'today', cells: ['DN-01', 'Carlos Moreira', a('Dr. Felipe', 0), s('In Chair', '#579bfc'), 'Cleaning'] },
      { id: 'DN-02', groupId: 'today', cells: ['DN-02', 'Julia Nascimento', a('Dra. Beatriz', 1), s('Waiting', '#fdab3d'), 'Root Canal'] },
      { id: 'DN-03', groupId: 'today', cells: ['DN-03', 'Marcos Vieira', a('Dr. Felipe', 0), s('Scheduled', '#a25ddc'), 'Crown'] },
      { id: 'DN-04', groupId: 'followup', cells: ['DN-04', 'Ana Clara', a('Dra. Beatriz', 1), s('Follow-up', '#00c875'), 'Implant'] },
    ],
    groups: [
      { id: 'today', label: 'Today\'s Schedule', color: '#579bfc' },
      { id: 'followup', label: 'Follow-ups', color: '#00c875' },
    ],
  },
  pharmacy: {
    entities: [
      { id: 'products', name: 'Products', count: 1860, active: true },
      { id: 'prescriptions', name: 'Prescriptions', count: 124 },
      { id: 'suppliers', name: 'Suppliers', count: 42 },
    ],
    columns: [
      { label: 'Code', width: '12%' },
      { label: 'Medicine', width: '26%' },
      { label: 'Pharmacist', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Stock', width: '12%' },
    ],
    rows: [
      { id: 'PH-01', groupId: 'ok', cells: ['PH-01', 'Amoxicilina 500mg', a('Farm. Ana', 0), s('OK', '#00c875'), '340'] },
      { id: 'PH-02', groupId: 'ok', cells: ['PH-02', 'Dipirona 1g', a('Farm. Pedro', 1), s('OK', '#00c875'), '520'] },
      { id: 'PH-03', groupId: 'alert', cells: ['PH-03', 'Insulina NPH', a('Farm. Julia', 2), s('Low Stock', '#fdab3d'), '8'] },
      { id: 'PH-04', groupId: 'alert', cells: ['PH-04', 'Rivotril 2mg', a('Farm. Ana', 0), s('Controlled', '#a25ddc'), '24'] },
    ],
    groups: [
      { id: 'ok', label: 'Regular Stock', color: '#00c875' },
      { id: 'alert', label: 'Attention', color: '#fdab3d' },
    ],
  },
  veterinary: {
    entities: [
      { id: 'patients', name: 'Patients', count: 320, active: true },
      { id: 'owners', name: 'Owners', count: 186 },
      { id: 'vaccines', name: 'Vaccines', count: 42 },
    ],
    columns: [
      { label: 'ID', width: '12%' },
      { label: 'Pet', width: '24%' },
      { label: 'Vet', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Species', width: '14%' },
    ],
    rows: [
      { id: 'VT-01', groupId: 'today', cells: ['VT-01', 'Rex (Dono: Joao)', a('Dr. Marcos', 0), s('In Consult', '#579bfc'), 'Dog'] },
      { id: 'VT-02', groupId: 'today', cells: ['VT-02', 'Mimi (Dono: Ana)', a('Dra. Paula', 1), s('Waiting', '#fdab3d'), 'Cat'] },
      { id: 'VT-03', groupId: 'today', cells: ['VT-03', 'Thor (Dono: Pedro)', a('Dr. Marcos', 0), s('Vaccine', '#00c875'), 'Dog'] },
      { id: 'VT-04', groupId: 'boarding', cells: ['VT-04', 'Luna (Dono: Maria)', a('Aux. Julia', 3), s('Boarding', '#a25ddc'), 'Cat'] },
    ],
    groups: [
      { id: 'today', label: 'Today', color: '#579bfc' },
      { id: 'boarding', label: 'Hotel/Boarding', color: '#a25ddc' },
    ],
  },
  therapy: {
    entities: [
      { id: 'clients', name: 'Clients', count: 86, active: true },
      { id: 'sessions', name: 'Sessions', count: 420 },
      { id: 'plans', name: 'Treatment Plans', count: 62 },
    ],
    columns: [
      { label: 'ID', width: '12%' },
      { label: 'Client', width: '26%' },
      { label: 'Therapist', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'TH-01', groupId: 'active', cells: ['TH-01', 'Mariana Costa', a('Psi. Helena', 0), s('Active', '#00c875')] },
      { id: 'TH-02', groupId: 'active', cells: ['TH-02', 'Roberto Santos', a('Psi. Marcos', 1), s('Active', '#00c875')] },
      { id: 'TH-03', groupId: 'active', cells: ['TH-03', 'Fernanda Alves', a('Psi. Helena', 0), s('Evaluation', '#579bfc')] },
      { id: 'TH-04', groupId: 'discharged', cells: ['TH-04', 'Lucas Pereira', a('Psi. Ana', 3), s('Discharged', '#a25ddc')] },
    ],
    groups: [
      { id: 'active', label: 'Active Clients', color: '#00c875' },
      { id: 'discharged', label: 'Discharged', color: '#a25ddc' },
    ],
  },
  lab: {
    entities: [
      { id: 'exams', name: 'Exams', count: 234, active: true },
      { id: 'patients', name: 'Patients', count: 180 },
      { id: 'equipment', name: 'Equipment', count: 28 },
    ],
    columns: [
      { label: 'Sample', width: '12%' },
      { label: 'Exam', width: '26%' },
      { label: 'Analyst', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'LB-01', groupId: 'processing', cells: ['LB-4521', 'Hemograma Completo', a('Bio. Julia', 0), s('Processing', '#fdab3d')] },
      { id: 'LB-02', groupId: 'processing', cells: ['LB-4522', 'TSH + T4 Livre', a('Bio. Pedro', 1), s('Processing', '#fdab3d')] },
      { id: 'LB-03', groupId: 'ready', cells: ['LB-4520', 'Glicemia de Jejum', a('Bio. Ana', 2), s('Ready', '#00c875')] },
      { id: 'LB-04', groupId: 'ready', cells: ['LB-4519', 'Urina Tipo I', a('Bio. Marcos', 3), s('Delivered', '#579bfc')] },
    ],
    groups: [
      { id: 'processing', label: 'Processing', color: '#fdab3d' },
      { id: 'ready', label: 'Results Ready', color: '#00c875' },
    ],
  },
  optical: {
    entities: [
      { id: 'orders', name: 'Orders', count: 78, active: true },
      { id: 'clients', name: 'Clients', count: 245 },
      { id: 'frames', name: 'Frames', count: 320 },
    ],
    columns: [
      { label: 'Order', width: '12%' },
      { label: 'Client', width: '24%' },
      { label: 'Optician', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Type', width: '14%' },
    ],
    rows: [
      { id: 'OP-01', groupId: 'active', cells: ['OP-301', 'Carlos Mendes', a('Opt. Ana', 0), s('In Lab', '#fdab3d'), 'Bifocal'] },
      { id: 'OP-02', groupId: 'active', cells: ['OP-302', 'Maria Lima', a('Opt. Pedro', 1), s('Ready', '#00c875'), 'Single'] },
      { id: 'OP-03', groupId: 'active', cells: ['OP-303', 'Roberto Alves', a('Opt. Julia', 2), s('In Lab', '#fdab3d'), 'Progressive'] },
      { id: 'OP-04', groupId: 'pickup', cells: ['OP-300', 'Ana Paula', a('Opt. Ana', 0), s('Pickup', '#579bfc'), 'Contact'] },
    ],
    groups: [
      { id: 'active', label: 'In Progress', color: '#fdab3d' },
      { id: 'pickup', label: 'Ready for Pickup', color: '#579bfc' },
    ],
  },
  'home-care': {
    entities: [
      { id: 'patients', name: 'Patients', count: 42, active: true },
      { id: 'caregivers', name: 'Caregivers', count: 18 },
      { id: 'visits', name: 'Visits', count: 234 },
    ],
    columns: [
      { label: 'ID', width: '12%' },
      { label: 'Patient', width: '24%' },
      { label: 'Caregiver', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Next Visit', width: '14%' },
    ],
    rows: [
      { id: 'HC-01', groupId: 'active', cells: ['HC-01', 'Dona Maria, 82', a('Enf. Julia', 0), s('Active', '#00c875'), 'Today'] },
      { id: 'HC-02', groupId: 'active', cells: ['HC-02', 'Sr. Roberto, 76', a('Enf. Pedro', 1), s('Active', '#00c875'), 'Tomorrow'] },
      { id: 'HC-03', groupId: 'active', cells: ['HC-03', 'Dona Lucia, 89', a('Enf. Ana', 2), s('Alert', '#e2445c'), 'Today'] },
      { id: 'HC-04', groupId: 'paused', cells: ['HC-04', 'Sr. Carlos, 71', a('Enf. Marcos', 3), s('Paused', '#fdab3d'), 'N/A'] },
    ],
    groups: [
      { id: 'active', label: 'Active Patients', color: '#00c875' },
      { id: 'paused', label: 'On Hold', color: '#fdab3d' },
    ],
  },

  // ── Education sub-niches ─────────────────
  school: {
    entities: [
      { id: 'students', name: 'Students', count: 620, active: true },
      { id: 'classes', name: 'Classes', count: 24 },
      { id: 'teachers', name: 'Teachers', count: 42 },
    ],
    columns: [
      { label: 'RA', width: '12%' },
      { label: 'Student', width: '24%' },
      { label: 'Teacher', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Class', width: '14%' },
    ],
    rows: [
      { id: 'AL-01', groupId: 'active', cells: ['2026001', 'Gabriel Martins', a('Prof. Clara', 0), s('Active', '#00c875'), '9A'] },
      { id: 'AL-02', groupId: 'active', cells: ['2026002', 'Isabela Ferreira', a('Prof. Marcos', 1), s('Active', '#00c875'), '9B'] },
      { id: 'AL-03', groupId: 'active', cells: ['2026003', 'Thiago Souza', a('Prof. Clara', 0), s('At Risk', '#e2445c'), '9A'] },
      { id: 'AL-04', groupId: 'transferred', cells: ['2026004', 'Larissa Costa', a('Prof. Ana', 3), s('Transferred', '#579bfc'), '8C'] },
    ],
    groups: [
      { id: 'active', label: 'Active Students', color: '#00c875' },
      { id: 'transferred', label: 'Transferred', color: '#579bfc' },
    ],
  },
  'online-courses': {
    entities: [
      { id: 'courses', name: 'Courses', count: 36, active: true },
      { id: 'students', name: 'Students', count: 2450 },
      { id: 'modules', name: 'Modules', count: 186 },
    ],
    columns: [
      { label: 'ID', width: '12%' },
      { label: 'Course', width: '28%' },
      { label: 'Instructor', width: '18%' },
      { label: 'Status', width: '18%' },
    ],
    rows: [
      { id: 'OC-01', groupId: 'active', cells: ['OC-01', 'Python para Iniciantes', a('Prof. Lucas', 0), s('Live', '#00c875')] },
      { id: 'OC-02', groupId: 'active', cells: ['OC-02', 'Marketing Digital', a('Prof. Ana', 1), s('Live', '#00c875')] },
      { id: 'OC-03', groupId: 'active', cells: ['OC-03', 'Design UX/UI', a('Prof. Julia', 2), s('Pre-launch', '#a25ddc')] },
      { id: 'OC-04', groupId: 'draft', cells: ['OC-04', 'Data Science Pro', a('Prof. Pedro', 3), s('Recording', '#fdab3d')] },
    ],
    groups: [
      { id: 'active', label: 'Published', color: '#00c875' },
      { id: 'draft', label: 'In Production', color: '#fdab3d' },
    ],
  },

  // ── Technology sub-niches ────────────────
  saas: {
    entities: [
      { id: 'features', name: 'Features', count: 86, active: true },
      { id: 'bugs', name: 'Bugs', count: 34 },
      { id: 'customers', name: 'Customers', count: 1240 },
    ],
    columns: [
      { label: 'ID', width: '12%' },
      { label: 'Feature', width: '26%' },
      { label: 'Owner', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Priority', width: '12%' },
    ],
    rows: [
      { id: 'FT-01', groupId: 'sprint', cells: ['FT-42', 'SSO Integration', a('Dev. Lucas', 0), s('In Review', '#579bfc'), s('P1', '#e2445c')] },
      { id: 'FT-02', groupId: 'sprint', cells: ['FT-43', 'Bulk Export CSV', a('Dev. Ana', 1), s('In Progress', '#fdab3d'), s('P2', '#fdab3d')] },
      { id: 'FT-03', groupId: 'sprint', cells: ['FT-44', 'Webhook Retry', a('Dev. Pedro', 2), s('Done', '#00c875'), s('P1', '#e2445c')] },
      { id: 'FT-04', groupId: 'backlog', cells: ['FT-45', 'Multi-tenant Billing', a('Dev. Julia', 3), s('Backlog', '#a25ddc'), s('P3', '#00c875')] },
    ],
    groups: [
      { id: 'sprint', label: 'Current Sprint', color: '#579bfc' },
      { id: 'backlog', label: 'Backlog', color: '#a25ddc' },
    ],
  },
  ecommerce: {
    entities: [
      { id: 'orders', name: 'Orders', count: 1450, active: true },
      { id: 'products', name: 'Products', count: 320 },
      { id: 'customers', name: 'Customers', count: 4200 },
    ],
    columns: [
      { label: 'Order', width: '12%' },
      { label: 'Customer', width: '24%' },
      { label: 'Support', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Total', width: '14%' },
    ],
    rows: [
      { id: 'OD-01', groupId: 'active', cells: ['#14521', 'Maria Silva', a('Sup. Ana', 0), s('Shipped', '#579bfc'), 'R$289'] },
      { id: 'OD-02', groupId: 'active', cells: ['#14522', 'Carlos Eduardo', a('Sup. Pedro', 1), s('Processing', '#fdab3d'), 'R$459'] },
      { id: 'OD-03', groupId: 'active', cells: ['#14523', 'Julia Santos', a('Sup. Ana', 0), s('Paid', '#00c875'), 'R$126'] },
      { id: 'OD-04', groupId: 'returns', cells: ['#14520', 'Roberto Alves', a('Sup. Marcos', 3), s('Return', '#e2445c'), 'R$89'] },
    ],
    groups: [
      { id: 'active', label: 'Active Orders', color: '#579bfc' },
      { id: 'returns', label: 'Returns', color: '#e2445c' },
    ],
  },

  // ── Hospitality sub-niches ───────────────
  hotel: {
    entities: [
      { id: 'reservations', name: 'Reservations', count: 86, active: true },
      { id: 'rooms', name: 'Rooms', count: 120 },
      { id: 'guests', name: 'Guests', count: 450 },
    ],
    columns: [
      { label: 'Res#', width: '12%' },
      { label: 'Guest', width: '24%' },
      { label: 'Staff', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Room', width: '12%' },
    ],
    rows: [
      { id: 'HT-01', groupId: 'checkin', cells: ['HT-501', 'Joao Pereira', a('Recep. Maria', 0), s('Checked In', '#00c875'), 'Suite 301'] },
      { id: 'HT-02', groupId: 'checkin', cells: ['HT-502', 'Elena Torres', a('Recep. Roberto', 1), s('Arriving', '#fdab3d'), 'Std 205'] },
      { id: 'HT-03', groupId: 'checkin', cells: ['HT-503', 'Michael Brown', a('Concierge Ana', 2), s('VIP', '#a25ddc'), 'Penth 601'] },
      { id: 'HT-04', groupId: 'checkout', cells: ['HT-500', 'Sofia Lima', a('Recep. Carlos', 3), s('Checkout', '#579bfc'), 'Std 108'] },
    ],
    groups: [
      { id: 'checkin', label: 'Current Guests', color: '#00c875' },
      { id: 'checkout', label: 'Checking Out', color: '#579bfc' },
    ],
  },
  'travel-agency': {
    entities: [
      { id: 'packages', name: 'Packages', count: 42, active: true },
      { id: 'bookings', name: 'Bookings', count: 86 },
      { id: 'clients', name: 'Clients', count: 234 },
    ],
    columns: [
      { label: 'Ref', width: '12%' },
      { label: 'Package', width: '26%' },
      { label: 'Agent', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Price', width: '14%' },
    ],
    rows: [
      { id: 'PK-01', groupId: 'active', cells: ['PK-01', 'Maldivas 7 Noites', a('Ag. Julia', 0), s('Available', '#00c875'), 'R$12.900'] },
      { id: 'PK-02', groupId: 'active', cells: ['PK-02', 'Europa 15 Dias', a('Ag. Bruno', 1), s('Best Seller', '#a25ddc'), 'R$18.500'] },
      { id: 'PK-03', groupId: 'active', cells: ['PK-03', 'Patagonia Adventure', a('Ag. Ana', 2), s('Few Left', '#fdab3d'), 'R$8.900'] },
      { id: 'PK-04', groupId: 'promo', cells: ['PK-04', 'Caribe All Inclusive', a('Ag. Pedro', 3), s('Promo', '#e2445c'), 'R$6.990'] },
    ],
    groups: [
      { id: 'active', label: 'Active Packages', color: '#00c875' },
      { id: 'promo', label: 'Promotions', color: '#e2445c' },
    ],
  },

  // ── Agriculture sub-niches ───────────────
  farming: {
    entities: [
      { id: 'plots', name: 'Plots', count: 32, active: true },
      { id: 'harvests', name: 'Harvests', count: 48 },
      { id: 'inputs', name: 'Inputs', count: 86 },
    ],
    columns: [
      { label: 'Plot', width: '12%' },
      { label: 'Crop', width: '24%' },
      { label: 'Agronomist', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Area', width: '14%' },
    ],
    rows: [
      { id: 'FM-01', groupId: 'growing', cells: ['A-01', 'Soja (Safra 26)', a('Agr. Rubens', 0), s('Growing', '#00c875'), '250 ha'] },
      { id: 'FM-02', groupId: 'growing', cells: ['A-02', 'Milho Safrinha', a('Agr. Lucia', 1), s('Growing', '#00c875'), '180 ha'] },
      { id: 'FM-03', groupId: 'growing', cells: ['B-01', 'Algodao', a('Agr. Marcos', 2), s('Spraying', '#fdab3d'), '320 ha'] },
      { id: 'FM-04', groupId: 'harvest', cells: ['C-01', 'Trigo', a('Agr. Helena', 3), s('Harvest', '#579bfc'), '120 ha'] },
    ],
    groups: [
      { id: 'growing', label: 'In Season', color: '#00c875' },
      { id: 'harvest', label: 'Harvest', color: '#579bfc' },
    ],
  },
  livestock: {
    entities: [
      { id: 'herds', name: 'Herds', count: 8, active: true },
      { id: 'animals', name: 'Animals', count: 2400 },
      { id: 'health', name: 'Health Records', count: 560 },
    ],
    columns: [
      { label: 'Herd', width: '12%' },
      { label: 'Location', width: '24%' },
      { label: 'Manager', width: '18%' },
      { label: 'Status', width: '18%' },
      { label: 'Head', width: '14%' },
    ],
    rows: [
      { id: 'HR-01', groupId: 'active', cells: ['HR-01', 'Pasto Norte', a('Vaq. Jose', 0), s('Healthy', '#00c875'), '450'] },
      { id: 'HR-02', groupId: 'active', cells: ['HR-02', 'Pasto Sul', a('Vaq. Pedro', 1), s('Healthy', '#00c875'), '320'] },
      { id: 'HR-03', groupId: 'active', cells: ['HR-03', 'Confinamento', a('Vet. Ana', 2), s('Vaccination', '#fdab3d'), '180'] },
      { id: 'HR-04', groupId: 'quarantine', cells: ['HR-04', 'Quarentena', a('Vet. Marcos', 3), s('Quarantine', '#e2445c'), '15'] },
    ],
    groups: [
      { id: 'active', label: 'Active Herds', color: '#00c875' },
      { id: 'quarantine', label: 'Quarantine', color: '#e2445c' },
    ],
  },
}

// ── Lookup function ─────────────────────────────────────────────────────

export function getNichePreviewConfig(
  niche?: string,
  subNiche?: string,
): NichePreviewConfig | undefined {
  if (!niche) return undefined
  // Try sub-niche first, then niche default
  if (subNiche && SUB_NICHE_CONFIGS[subNiche]) {
    return SUB_NICHE_CONFIGS[subNiche]
  }
  return NICHE_DEFAULTS[niche] ?? NICHE_DEFAULTS['retail']
}
