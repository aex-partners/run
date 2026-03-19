import React, { useRef, useEffect } from 'react'
import { Plus, Search, ScrollText, Settings2 } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import type { DatabaseEntity } from './DatabaseScreen'

interface EntitySidebarProps {
  entities: DatabaseEntity[]
  activeEntityId?: string
  searchText: string
  onSearchChange: (text: string) => void
  onEntitySelect: (id: string) => void
  onNewEntity?: () => void
  onRenameEntity?: (id: string, name: string) => void
  onManageEntity?: (id: string) => void
  onViewLogs?: (id: string) => void
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
  onManageEntity,
  onViewLogs,
}: EntitySidebarProps) {
  const [hoveredId, setHoveredId] = React.useState<string | undefined>(undefined)
  const [editingId, setEditingId] = React.useState<string | undefined>(undefined)
  const [editValue, setEditValue] = React.useState('')
  const [contextMenu, setContextMenu] = React.useState<{ entityId: string; x: number; y: number } | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

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
        width: 240,
        minWidth: 240,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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
        <span style={{ fontWeight: 600, fontSize: 14 }}>Entities</span>
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
            placeholder="Search entities..."
            aria-label="Search entities"
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
                  title={`Manage ${entity.name}`}
                  aria-label={`Manage ${entity.name}`}
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
              No entities match your search.
            </div>
          )}
        </ScrollArea.Viewport>
      </ScrollArea.Root>

      {/* Context menu */}
      {contextMenu && (
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
              onViewLogs?.(contextMenu.entityId)
              setContextMenu(null)
            }}
            style={contextMenuItemStyle}
          >
            <ScrollText size={13} /> Logs
          </button>
          <button
            onClick={() => {
              onManageEntity?.(contextMenu.entityId)
              setContextMenu(null)
            }}
            style={contextMenuItemStyle}
          >
            <Settings2 size={13} /> Manage
          </button>
        </div>
      )}
    </aside>
  )
}
