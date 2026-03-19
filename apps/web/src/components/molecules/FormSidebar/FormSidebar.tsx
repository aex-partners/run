import React, { useRef, useEffect } from 'react'
import { Plus, Search, Trash2, Pencil, Link, FileText } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { t } from '../../../locales/en'

export interface FormItem {
  id: string
  name: string
  isPublic: boolean
  publicToken?: string | null
  submissionCount?: number
}

export interface FormSidebarProps {
  forms: FormItem[]
  activeFormId?: string
  onFormSelect: (id: string) => void
  onNewForm?: () => void
  onRenameForm?: (id: string, name: string) => void
  onDeleteForm?: (id: string) => void
  onCopyLink?: (id: string) => void
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

export function FormSidebar({
  forms,
  activeFormId,
  onFormSelect,
  onNewForm,
  onRenameForm,
  onDeleteForm,
  onCopyLink,
}: FormSidebarProps) {
  const [searchText, setSearchText] = React.useState('')
  const [hoveredId, setHoveredId] = React.useState<string | undefined>(undefined)
  const [editingId, setEditingId] = React.useState<string | undefined>(undefined)
  const [editValue, setEditValue] = React.useState('')
  const [contextMenu, setContextMenu] = React.useState<{ formId: string; x: number; y: number } | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

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

  const filtered = searchText.trim()
    ? forms.filter((f) => f.name.toLowerCase().includes(searchText.toLowerCase()))
    : forms

  const startEditing = (form: FormItem) => {
    setEditValue(form.name)
    setEditingId(form.id)
  }

  const commitEdit = () => {
    if (!editingId) return
    const trimmed = editValue.trim()
    if (trimmed) {
      onRenameForm?.(editingId, trimmed)
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
        <span style={{ fontWeight: 600, fontSize: 14 }}>{t.database.forms.title}</span>
        <button
          onClick={onNewForm}
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
            placeholder={t.database.forms.searchPlaceholder}
            aria-label={t.database.forms.searchPlaceholder}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
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
          {filtered.map((form) => (
            <div
              key={form.id}
              onMouseEnter={() => setHoveredId(form.id)}
              onMouseLeave={() => setHoveredId(undefined)}
              onContextMenu={(e) => {
                e.preventDefault()
                onFormSelect(form.id)
                setContextMenu({ formId: form.id, x: e.clientX, y: e.clientY })
              }}
              style={{ position: 'relative' }}
            >
              <button
                onClick={() => onFormSelect(form.id)}
                onDoubleClick={() => startEditing(form)}
                style={{
                  width: '100%',
                  padding: '7px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: activeFormId === form.id ? 'var(--accent-light)' : 'transparent',
                  border: 'none',
                  borderLeft: activeFormId === form.id ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                  fontFamily: 'inherit',
                  paddingRight: hoveredId === form.id ? 36 : 12,
                }}
              >
                <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                {editingId === form.id ? (
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
                      color: activeFormId === form.id ? 'var(--accent)' : 'var(--text)',
                      fontWeight: activeFormId === form.id ? 500 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {form.name}
                  </span>
                )}
                {form.isPublic && editingId !== form.id && (
                  <Link size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                )}
              </button>

              {hoveredId === form.id && editingId !== form.id && onDeleteForm && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteForm(form.id)
                  }}
                  title={`Delete ${form.name}`}
                  aria-label={`Delete ${form.name}`}
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
                    color: 'var(--danger, #dc2626)',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}

          {filtered.length === 0 && forms.length > 0 && (
            <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              No forms match your search.
            </div>
          )}

          {forms.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <FileText size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {t.database.forms.noForms}
              </div>
            </div>
          )}
        </ScrollArea.Viewport>
      </ScrollArea.Root>

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
              const form = forms.find((f) => f.id === contextMenu.formId)
              if (form) startEditing(form)
              setContextMenu(null)
            }}
            style={contextMenuItemStyle}
          >
            <Pencil size={13} /> {t.database.forms.rename}
          </button>
          {onCopyLink && (
            <button
              onClick={() => {
                onCopyLink(contextMenu.formId)
                setContextMenu(null)
              }}
              style={contextMenuItemStyle}
            >
              <Link size={13} /> {t.database.forms.copyLink}
            </button>
          )}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          {onDeleteForm && (
            <button
              onClick={() => {
                onDeleteForm(contextMenu.formId)
                setContextMenu(null)
              }}
              style={{ ...contextMenuItemStyle, color: 'var(--danger, #dc2626)' }}
            >
              <Trash2 size={13} /> {t.database.forms.delete}
            </button>
          )}
        </div>
      )}
    </aside>
  )
}
