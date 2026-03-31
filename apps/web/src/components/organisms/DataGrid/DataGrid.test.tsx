import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DataGrid, type GridColumn, type GridRow, type RowGroup } from './DataGrid'

const basicColumns: GridColumn[] = [
  { id: 'id', label: 'ID', type: 'text', width: 80 },
  { id: 'name', label: 'Name', type: 'text', width: 200 },
  { id: 'status', label: 'Status', type: 'badge', width: 120 },
]

const basicRows: GridRow[] = [
  { id: '1', name: 'Alpha', status: 'Active' },
  { id: '2', name: 'Beta', status: 'Inactive' },
  { id: '3', name: 'Gamma', status: 'Pending' },
]

describe('DataGrid', () => {
  it('renders rows and columns', () => {
    render(<DataGrid columns={basicColumns} rows={basicRows} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
  })

  describe('Groups', () => {
    const groups: RowGroup[] = [
      { id: 'g1', label: 'Group One', color: '#00c875' },
      { id: 'g2', label: 'Group Two', color: '#579bfc' },
    ]
    const groupedRows: GridRow[] = [
      { id: '1', name: 'Alpha', status: 'Active', _groupId: 'g1' },
      { id: '2', name: 'Beta', status: 'Inactive', _groupId: 'g1' },
      { id: '3', name: 'Gamma', status: 'Pending', _groupId: 'g2' },
    ]

    it('renders group headers', () => {
      render(<DataGrid columns={basicColumns} rows={groupedRows} groups={groups} />)
      expect(screen.getByTestId('group-header-g1')).toBeInTheDocument()
      expect(screen.getByTestId('group-header-g2')).toBeInTheDocument()
      expect(screen.getByText('Group One')).toBeInTheDocument()
      expect(screen.getByText('Group Two')).toBeInTheDocument()
    })

    it('shows row count in group header', () => {
      render(<DataGrid columns={basicColumns} rows={groupedRows} groups={groups} />)
      const g1Header = screen.getByTestId('group-header-g1')
      const g2Header = screen.getByTestId('group-header-g2')
      expect(g1Header).toHaveTextContent('2')
      expect(g2Header).toHaveTextContent('1')
    })

    it('renders groups with initially collapsed state', () => {
      const collapsedGroups: RowGroup[] = [
        { id: 'g1', label: 'Group One', color: '#00c875', collapsed: true },
        { id: 'g2', label: 'Group Two', color: '#579bfc' },
      ]
      render(<DataGrid columns={basicColumns} rows={groupedRows} groups={collapsedGroups} />)

      // Group One rows should be hidden (collapsed)
      expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
      expect(screen.queryByText('Beta')).not.toBeInTheDocument()
      // Group Two rows still visible
      expect(screen.getByText('Gamma')).toBeInTheDocument()
    })
  })

  describe('Status cells', () => {
    it('renders status pill with correct color', () => {
      const statusColumns: GridColumn[] = [
        { id: 'id', label: 'ID', type: 'text', width: 80 },
        {
          id: 'status', label: 'Status', type: 'status', width: 130,
          statusColors: { 'Done': '#00c875', 'Stuck': '#e2445c' },
        },
      ]
      const statusRows: GridRow[] = [
        { id: '1', status: 'Done' },
        { id: '2', status: 'Stuck' },
      ]
      render(<DataGrid columns={statusColumns} rows={statusRows} />)
      const doneEl = screen.getByText('Done')
      expect(doneEl).toBeInTheDocument()
      expect(doneEl.style.background).toBe('rgb(0, 200, 117)')
      expect(doneEl.style.color).toBe('rgb(255, 255, 255)')
    })
  })

  describe('Person cells', () => {
    it('renders avatar for person type', () => {
      const personColumns: GridColumn[] = [
        { id: 'id', label: 'ID', type: 'text', width: 80 },
        { id: 'assignee', label: 'Assignee', type: 'person', width: 120 },
      ]
      const personRows: GridRow[] = [
        { id: '1', assignee: 'Ana Silva' },
      ]
      render(<DataGrid columns={personColumns} rows={personRows} />)
      expect(screen.getByText('AS')).toBeInTheDocument() // Avatar initials
    })

    it('renders multiple avatars for comma-separated names', () => {
      const personColumns: GridColumn[] = [
        { id: 'id', label: 'ID', type: 'text', width: 80 },
        { id: 'team', label: 'Team', type: 'person', width: 160 },
      ]
      const personRows: GridRow[] = [
        { id: '1', team: 'Ana Silva, Pedro Costa' },
      ]
      render(<DataGrid columns={personColumns} rows={personRows} />)
      expect(screen.getByText('AS')).toBeInTheDocument()
      expect(screen.getByText('PC')).toBeInTheDocument()
    })
  })

  describe('Currency cells', () => {
    it('formats currency values', () => {
      const currencyColumns: GridColumn[] = [
        { id: 'id', label: 'ID', type: 'text', width: 80 },
        { id: 'amount', label: 'Amount', type: 'currency', width: 120, currencyCode: 'USD' },
      ]
      const currencyRows: GridRow[] = [
        { id: '1', amount: 1234.56 },
      ]
      render(<DataGrid columns={currencyColumns} rows={currencyRows} />)
      expect(screen.getByText('$1,234.56')).toBeInTheDocument()
    })
  })

  describe('Skeleton loading', () => {
    it('shows skeleton rows when rows are empty and no emptyMessage', () => {
      render(<DataGrid columns={basicColumns} rows={[]} />)
      const skeletonRows = screen.getAllByTestId('skeleton-row')
      expect(skeletonRows).toHaveLength(3)
    })

    it('shows empty message when provided', () => {
      render(<DataGrid columns={basicColumns} rows={[]} emptyMessage="No data available" />)
      expect(screen.getByText('No data available')).toBeInTheDocument()
      expect(screen.queryByTestId('skeleton-row')).not.toBeInTheDocument()
    })
  })

  describe('Priority cells', () => {
    it('renders priority with colored dot', () => {
      const priorityColumns: GridColumn[] = [
        { id: 'id', label: 'ID', type: 'text', width: 80 },
        { id: 'priority', label: 'Priority', type: 'priority', width: 120 },
      ]
      const priorityRows: GridRow[] = [
        { id: '1', priority: 'High' },
        { id: '2', priority: 'Low' },
      ]
      render(<DataGrid columns={priorityColumns} rows={priorityRows} />)
      expect(screen.getByText('High')).toBeInTheDocument()
      expect(screen.getByText('Low')).toBeInTheDocument()
    })
  })
})
