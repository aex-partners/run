import { Suspense, lazy, useEffect, useState } from 'react'
import { PanelLeftOpen } from 'lucide-react'
import { EntitySidebar } from './EntitySidebar'
import { ViewKeyContext } from '../goodviews/viewKeyContext'
import type { Field, ViewConfig } from '../goodviews/types'
import type { PageQuery, PageResult } from '../goodviews/server'
import type { TableCallbacks } from '../goodviews/adapter'

// The Table View (good-views engine) is heavy (tanstack-table + dnd-kit); load it
// lazily so the Database shell paints instantly.
const TableView = lazy(() => import('../goodviews/views/TableView'))

export interface DatabaseEntity {
  id: string
  name: string
  count: number
  icon?: React.ReactNode
  color?: string
  iconName?: string
}

export interface DatabaseScreenProps {
  entities: DatabaseEntity[]
  activeEntityId?: string
  onEntitySelect?: (id: string) => void
  onNewEntity?: () => void
  onRenameEntity?: (id: string, name: string) => void
  onDeleteEntity?: (id: string) => void
  /** good-views fields for the active entity (mapped from the entity schema). */
  tableFields?: Field[]
  /** server-side page fetcher bound to the active entity (SERVER mode). */
  fetchPage?: (q: PageQuery) => Promise<PageResult>
  /** persisted mutations for inline edit / delete / create. */
  callbacks?: TableCallbacks
}

/**
 * Database screen shell: the entity-list sidebar plus the content area. When an
 * entity is selected (and its fields + a server fetcher are ready), the content
 * area hosts the good-views Table View in SERVER mode; otherwise it stays blank.
 */
export function DatabaseScreen({
  entities,
  activeEntityId,
  onEntitySelect,
  onNewEntity,
  onRenameEntity,
  onDeleteEntity,
  tableFields,
  fetchPage,
  callbacks,
}: DatabaseScreenProps) {
  const [searchText, setSearchText] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [config, setConfig] = useState<ViewConfig>({})

  // Reset the view config (all columns visible) whenever the active entity or its
  // schema changes, so each entity starts with every field shown.
  useEffect(() => {
    setConfig({ visibleFieldIds: (tableFields ?? []).map((f) => f.id) })
  }, [activeEntityId, tableFields])

  const showTable = !!activeEntityId && !!fetchPage && !!tableFields?.length

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <EntitySidebar
        entities={entities}
        activeEntityId={activeEntityId}
        searchText={searchText}
        onSearchChange={setSearchText}
        onEntitySelect={(id) => onEntitySelect?.(id)}
        onNewEntity={onNewEntity}
        onRenameEntity={onRenameEntity}
        onDeleteEntity={onDeleteEntity}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />
      {/* Floating reopen button when the sidebar is collapsed. */}
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Mostrar entidades"
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <PanelLeftOpen size={16} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0, background: '#ffffff' }}>
        {showTable ? (
          <div className="gv-scope" style={{ height: '100%', minHeight: 0 }}>
            <Suspense fallback={<div style={{ height: '100%', background: '#ffffff' }} />}>
              <ViewKeyContext.Provider value="database-table">
                <TableView
                  records={[]}
                  fields={tableFields!}
                  config={config}
                  onConfigChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
                  onEdit={callbacks?.onEdit ?? (() => {})}
                  onRowDelete={callbacks?.onRowDelete}
                  onCreate={callbacks?.onCreate}
                  fetchPage={fetchPage}
                />
              </ViewKeyContext.Provider>
            </Suspense>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default DatabaseScreen
