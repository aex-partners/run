import { LayoutGrid, Columns3, Calendar, FileText } from 'lucide-react'
import type { ViewType } from '../../organisms/DataGrid/types'

interface ViewSwitcherProps {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
}

const views: { type: ViewType; icon: typeof LayoutGrid; label: string }[] = [
  { type: 'table', icon: LayoutGrid, label: 'Table' },
  { type: 'kanban', icon: Columns3, label: 'Kanban' },
  { type: 'calendar', icon: Calendar, label: 'Calendar' },
  { type: 'form', icon: FileText, label: 'Form' },
]

export function ViewSwitcher({ activeView, onViewChange }: ViewSwitcherProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
    }}>
      {views.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          onClick={() => onViewChange(type)}
          title={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'inherit',
            background: activeView === type ? 'var(--accent-light)' : 'transparent',
            color: activeView === type ? 'var(--accent)' : 'var(--text-muted)',
            transition: 'all 0.1s',
          }}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}
