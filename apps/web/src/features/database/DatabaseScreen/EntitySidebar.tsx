import { useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Settings2, Trash2, PanelLeftClose } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import * as Portal from '@radix-ui/react-portal'
import type { DatabaseEntity } from './DatabaseScreen'

interface EntitySidebarProps {
  entities: DatabaseEntity[]
  activeEntityId?: string
  searchText: string
  onSearchChange: (text: string) => void
  onEntitySelect: (id: string) => void
  onNewEntity?: () => void
  onRenameEntity?: (id: string, name: string) => void
  onDeleteEntity?: (id: string) => void
  onManageEntity?: (id: string) => void
  /** Session-scoped collapse: when true the aside animates to width 0. */
  collapsed?: boolean
  onToggleCollapse?: () => void
}

const contextMenuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '7px 14px',
  background: 'none',
  border: 'none',
  fontSize: 13,
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
}

export function EntitySidebar({
  entities,
  activeEntityId,
  searchText,
  onSearchChange,
  onEntitySelect,
  onNewEntity,
  onRenameEntity,
  onDeleteEntity,
  onManageEntity,
  collapsed = false,
  onToggleCollapse,
}: EntitySidebarProps) {
  const { t } = useTranslation()
  const [hoveredId, setHoveredId] = useState<string | undefined>(undefined)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [editValue, setEditValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{ entityId: string; x: number; y: number } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ entityId: string; entityName: string } | null>(null)
  const [deleteInput, setDeleteInput] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const deleteInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  useEffect(() => {
    if (deleteConfirm && deleteInputRef.current) {
      deleteInputRef.current.focus()
    }
  }, [deleteConfirm])

  const confirmDelete = () => {
    if (!deleteConfirm) return
    if (deleteInput === deleteConfirm.entityName) {
      onDeleteEntity?.(deleteConfirm.entityId)
      setDeleteConfirm(null)
      setDeleteInput('')
    }
  }

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  const filteredEntities = searchText.trim()
    ? entities.filter((e) => e.name.toLowerCase().includes(searchText.toLowerCase()))
    : entities

  const startEditing = (entity: DatabaseEntity) => {
    setEditValue(entity.name)
    setEditingId(entity.id)
  }

  const commitEdit = () => {
    if (!editingId) return
    const trimmed = editValue.trim()
    if (trimmed) {
      onRenameEntity?.(editingId, trimmed)
    }
    setEditingId(undefined)
  }

  return (
    <aside
      style={{
        width: collapsed ? 0 : 240,
        minWidth: collapsed ? 0 : 240,
        background: 'var(--surface)',
        borderRight: collapsed ? 'none' : '1px solid var(--border)',
        overflow: 'hidden',
        flexShrink: 0,
        transition: 'width 180ms ease, min-width 180ms ease',
      }}
      aria-hidden={collapsed}
    >
      {/* Fixed-width content so the aside can clip it to 0 without reflowing text. */}
      <div style={{ width: 240, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '16px 12px 8px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>{t('database.entities')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={onNewEntity}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
            }}
          >
            <Plus size={16} />
          </button>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title={t('database.entities')}
              aria-label={t('database.entities')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
              }}
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '8px 12px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--surface-2)',
            borderRadius: 6,
            padding: '5px 8px',
            border: '1px solid var(--border)',
          }}
        >
          <Search size={13} color="var(--text-muted)" />
          <input
            placeholder={t('database.searchPlaceholder')}
            aria-label={t('database.searchPlaceholder')}
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 12,
              width: '100%',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport style={{ height: '100%', padding: '4px 0' }}>
          {filteredEntities.map((entity) => (
            <div
              key={entity.id}
              onMouseEnter={() => setHoveredId(entity.id)}
              onMouseLeave={() => setHoveredId(undefined)}
              onContextMenu={(e) => {
                e.preventDefault()
                onEntitySelect(entity.id)
                setContextMenu({ entityId: entity.id, x: e.clientX, y: e.clientY })
              }}
              style={{ position: 'relative' }}
            >
              <button
                onClick={() => onEntitySelect(entity.id)}
                onDoubleClick={() => startEditing(entity)}
                style={{
                  width: '100%',
                  padding: '7px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: activeEntityId === entity.id ? 'var(--accent-light)' : 'transparent',
                  border: 'none',
                  borderLeft: activeEntityId === entity.id ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                  fontFamily: 'inherit',
                  paddingRight: hoveredId === entity.id ? 36 : 12,
                }}
              >
                {entity.icon && <span style={{ display: 'flex', color: 'var(--text-muted)' }}>{entity.icon}</span>}
                {editingId === entity.id ? (
                  <input
                    ref={editInputRef}
                    value={editValue}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') setEditingId(undefined)
                    }}
                    style={{
                      flex: 1,
                      fontSize: 13,
                      border: '1px solid var(--accent)',
                      borderRadius: 4,
                      padding: '1px 4px',
                      outline: 'none',
                      fontFamily: 'inherit',
                      color: 'var(--text)',
                      background: 'var(--surface)',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: activeEntityId === entity.id ? 'var(--accent)' : 'var(--text)',
                      fontWeight: activeEntityId === entity.id ? 500 : 400,
                    }}
                  >
                    {entity.name}
                  </span>
                )}
                {editingId !== entity.id && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      background: 'var(--surface-2)',
                      padding: '1px 6px',
                      borderRadius: 10,
                      flexShrink: 0,
                    }}
                  >
                    {entity.count.toLocaleString()}
                  </span>
                )}
              </button>

              {hoveredId === entity.id && editingId !== entity.id && onManageEntity && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onManageEntity(entity.id)
                  }}
                  title={t('database.manageEntityNamed', { name: entity.name })}
                  aria-label={t('database.manageEntityNamed', { name: entity.name })}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 3,
                    borderRadius: 4,
                    display: 'flex',
                    color: 'var(--text-muted)',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
                  }}
                >
                  <Settings2 size={13} />
                </button>
              )}
            </div>
          ))}

          {filteredEntities.length === 0 && (
            <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              {t('database.noEntitiesMatch')}
            </div>
          )}
        </ScrollArea.Viewport>
      </ScrollArea.Root>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <Portal.Root>
          <div
            ref={contextMenuRef}
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              zIndex: 200,
              minWidth: 160,
              padding: '4px 0',
            }}
          >
            <button
              onClick={() => {
                onManageEntity?.(contextMenu.entityId)
                setContextMenu(null)
              }}
              style={contextMenuItemStyle}
            >
              <Settings2 size={13} /> {t('database.manageEntity')}
            </button>
            {onDeleteEntity && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <button
                  onClick={() => {
                    const entity = entities.find((e) => e.id === contextMenu.entityId)
                    if (entity) {
                      setDeleteConfirm({ entityId: entity.id, entityName: entity.name })
                      setDeleteInput('')
                    }
                    setContextMenu(null)
                  }}
                  style={{ ...contextMenuItemStyle, color: '#dc2626' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                >
                  <Trash2 size={13} /> {t('database.deleteEntity')}
                </button>
              </>
            )}
          </div>
        </Portal.Root>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <Portal.Root>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 300,
            }}
            onClick={() => { setDeleteConfirm(null); setDeleteInput('') }}
          >
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 12,
                padding: 24,
                width: 380,
                maxWidth: '90vw',
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                border: '1px solid var(--border)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Trash2 size={18} color="#dc2626" />
                <span style={{ fontWeight: 600, fontSize: 15 }}>{t('database.deleteEntityTitle')}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
                {t('database.deleteEntityWarning', { name: deleteConfirm.entityName })}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                {t('database.deleteEntityConfirmLabel', { name: deleteConfirm.entityName })}
              </p>
              <input
                ref={deleteInputRef}
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmDelete()
                  if (e.key === 'Escape') { setDeleteConfirm(null); setDeleteInput('') }
                }}
                placeholder={deleteConfirm.entityName}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 13,
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  outline: 'none',
                  fontFamily: 'inherit',
                  color: 'var(--text)',
                  background: 'var(--surface-2)',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => { setDeleteConfirm(null); setDeleteInput('') }}
                  style={{
                    padding: '7px 16px',
                    fontSize: 13,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteInput !== deleteConfirm.entityName}
                  style={{
                    padding: '7px 16px',
                    fontSize: 13,
                    borderRadius: 6,
                    border: 'none',
                    background: deleteInput === deleteConfirm.entityName ? '#dc2626' : '#fca5a5',
                    color: '#fff',
                    cursor: deleteInput === deleteConfirm.entityName ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                    fontWeight: 500,
                  }}
                >
                  {t('database.deleteEntityConfirm')}
                </button>
              </div>
            </div>
          </div>
        </Portal.Root>
      )}
    </aside>
  )
}
