import { Suspense, lazy, useEffect, useState } from 'react'
import { PanelLeftOpen } from 'lucide-react'
import { EntitySidebar } from './EntitySidebar'
import { ViewKeyContext } from '../goodviews/viewKeyContext'
import type { Field, FieldType, ViewConfig, FieldConfigInput, EntityFieldLite } from '../goodviews/types'
import type { PageQuery, PageResult } from '../goodviews/server'
import type { TableCallbacks } from '../goodviews/adapter'
import { CreateEntityScreen, type CreateEntityPayload } from '../CreateEntityScreen/CreateEntityScreen'

/** callbacks de edição de schema + loaders de relação/campos (Part A/B). */
export interface SchemaCallbacks {
  onFieldUpdate?: (fieldId: string, updates: { name?: string; type?: FieldType; required?: boolean; defaultValue?: string } & FieldConfigInput) => void
  onFieldDelete?: (fieldId: string) => void
  onFieldDuplicate?: (fieldId: string) => void
  onFieldAdd?: (spec: { name: string; type: FieldType; required?: boolean; defaultValue?: string } & FieldConfigInput) => void
  loadRelationOptions?: (fieldId: string, search: string) => Promise<{ value: string; label: string }[]>
  /** carrega os campos de OUTRA entidade p/ os selects do editor de schema. */
  loadEntityFields?: (entityId: string) => Promise<EntityFieldLite[]>
}

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
  /** schema-edit callbacks + relation option loader (host-wired). */
  schema?: SchemaCallbacks
  /** when true, the content area shows the entity-creation screen instead of a view. */
  creating?: boolean
  onCreateEntity?: (payload: CreateEntityPayload) => void
  onCancelCreate?: () => void
  createBusy?: boolean
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
  schema,
  creating,
  onCreateEntity,
  onCancelCreate,
  createBusy,
}: DatabaseScreenProps) {
  const [searchText, setSearchText] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [config, setConfig] = useState<ViewConfig>({})

  // Reset the view config whenever the active entity or its schema changes, so each
  // entity starts with every field shown — EXCETO a coluna sintética de UUID
  // (type 'id'), que nasce oculta e o usuário liga pelo painel "Campos".
  useEffect(() => {
    setConfig({
      visibleFieldIds: (tableFields ?? []).filter((f) => f.type !== 'id').map((f) => f.id),
    })
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
            top: 7,
            left: 6,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <PanelLeftOpen size={16} />
        </button>
      )}
      {/* When collapsed, a small left gutter holds the reopen button in-line with
          the Table View's header toolbar (which starts after the gutter). */}
      <div style={{ flex: 1, minWidth: 0, background: '#ffffff', paddingLeft: collapsed && !creating ? 40 : 0 }}>
        {creating ? (
          <CreateEntityScreen
            entities={entities}
            onCreate={(payload) => onCreateEntity?.(payload)}
            onCancel={() => onCancelCreate?.()}
            busy={createBusy}
          />
        ) : showTable ? (
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
                  onFieldUpdate={schema?.onFieldUpdate}
                  onFieldDelete={schema?.onFieldDelete}
                  onFieldDuplicate={schema?.onFieldDuplicate}
                  onFieldAdd={schema?.onFieldAdd}
                  loadRelationOptions={schema?.loadRelationOptions}
                  entities={entities.map((e) => ({ id: e.id, name: e.name }))}
                  loadEntityFields={schema?.loadEntityFields}
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
