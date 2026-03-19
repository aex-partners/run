import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Filter, SlidersHorizontal, LayoutGrid, Columns3, Calendar, FileText, ChevronDown, Table as TableIcon } from 'lucide-react'
import { getNichePreviewConfig, type NichePreviewConfig } from '../../../../data/niche-preview-configs'

export interface NichePreviewPanelProps {
  niche?: string
  subNiche?: string
}

const cellStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12,
  color: 'var(--text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
}

const headerCellStyle: React.CSSProperties = {
  ...cellStyle,
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  padding: '8px 10px',
}

function MiniToolbarBtn({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 3,
      padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500,
      background: active ? 'var(--accent-light)' : 'var(--surface-2)',
      color: active ? 'var(--accent)' : 'var(--text-muted)',
      border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
    }}>
      {children}
    </div>
  )
}

function DataGridPreview({ config }: { config: NichePreviewConfig }) {
  const totalRows = config.rows.length

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 140, borderRight: '1px solid var(--border)', background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Entities</span>
          <Plus size={12} color="var(--text-muted)" />
        </div>
        <div style={{ padding: '6px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px',
            borderRadius: 4, background: 'var(--surface-2)', border: '1px solid var(--border)',
            fontSize: 10, color: 'var(--text-muted)',
          }}>
            <Search size={10} /> Search entities...
          </div>
        </div>
        {config.entities.map(e => (
          <div key={e.id} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            fontSize: 12, fontWeight: e.active ? 600 : 400,
            color: e.active ? 'var(--accent)' : 'var(--text)',
            borderLeft: e.active ? '2px solid var(--accent)' : '2px solid transparent',
            background: e.active ? 'var(--accent-light)' : 'transparent',
          }}>
            <TableIcon size={12} />
            <span style={{ flex: 1 }}>{e.name}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{e.count}</span>
          </div>
        ))}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* View tabs + toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', gap: 6, borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <MiniToolbarBtn active><LayoutGrid size={10} /> Table</MiniToolbarBtn>
          <MiniToolbarBtn><Columns3 size={10} /> Kanban</MiniToolbarBtn>
          <MiniToolbarBtn><Calendar size={10} /> Calendar</MiniToolbarBtn>
          <MiniToolbarBtn><FileText size={10} /> Form</MiniToolbarBtn>
          <div style={{ flex: 1 }} />
          <MiniToolbarBtn><Filter size={10} /></MiniToolbarBtn>
          <MiniToolbarBtn><SlidersHorizontal size={10} /> Columns</MiniToolbarBtn>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
            background: 'var(--accent)', color: '#fff',
          }}>
            <Plus size={10} /> New
          </div>
        </div>

        {/* Title bar */}
        <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            {config.entities.find(e => e.active)?.name || 'Data'}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 8 }}>
            {totalRows} records
          </span>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
          <div style={{ width: 28, padding: '8px 6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ width: 11, height: 11, borderRadius: 2, border: '1.5px solid var(--border)' }} />
          </div>
          {config.columns.map((col, i) => (
            <div key={i} style={{ ...headerCellStyle, width: col.width, flex: col.width ? undefined : 1 }}>
              {col.label} <ChevronDown size={9} style={{ marginLeft: 2, opacity: 0.5 }} />
            </div>
          ))}
          <div style={{ width: 28, ...headerCellStyle, justifyContent: 'center' }}>
            <Plus size={10} />
          </div>
          <div style={{ flex: 1 }} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {config.groups.map(group => {
            const groupRows = config.rows.filter(r => r.groupId === group.id)
            return (
              <React.Fragment key={group.id}>
                {/* Group header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderBottom: '1px solid var(--border)',
                  borderLeft: `3px solid ${group.color}`,
                  background: `${group.color}10`,
                }}>
                  <ChevronDown size={11} style={{ color: group.color }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: group.color }}>{group.label}</span>
                  <span style={{
                    fontSize: 9, color: 'var(--text-muted)', background: 'var(--surface-2)',
                    padding: '0px 6px', borderRadius: 8, border: '1px solid var(--border)',
                  }}>
                    {groupRows.length}
                  </span>
                </div>
                {/* Rows */}
                {groupRows.map(row => (
                  <div key={row.id} style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 28, padding: '8px 6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 11, height: 11, borderRadius: 2, border: '1.5px solid var(--border)' }} />
                    </div>
                    {row.cells.map((cell, ci) => (
                      <div key={ci} style={{
                        ...cellStyle,
                        width: config.columns[ci]?.width,
                        flex: config.columns[ci]?.width ? undefined : 1,
                        color: ci === 0 ? 'var(--text-muted)' : 'var(--text)',
                      }}>
                        {cell}
                      </div>
                    ))}
                    <div style={{ flex: 1 }} />
                  </div>
                ))}
              </React.Fragment>
            )
          })}
          {/* Add record */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '7px 36px', fontSize: 11, color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border)',
          }}>
            <Plus size={11} /> Record
          </div>
        </div>
      </div>
    </div>
  )
}

function SkeletonPreview() {
  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: '#fff' }}>
      <div style={{ padding: 20 }}>
        <div style={{ height: 12, width: '30%', background: 'var(--surface-2)', borderRadius: 4, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[0.15, 0.12, 0.18, 0.1].map((w, i) => (
            <div key={i} style={{ height: 28, width: `${w * 100}%`, background: 'var(--surface-2)', borderRadius: 6 }} />
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {[0.1, 0.25, 0.15, 0.15, 0.12].map((w, j) => (
              <div key={j} style={{ height: 10, width: `${w * 100}%`, background: 'var(--surface-2)', borderRadius: 4 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function NichePreviewPanel({ niche, subNiche }: NichePreviewPanelProps) {
  const config = getNichePreviewConfig(niche, subNiche)

  return (
    <div
      data-testid="niche-preview-panel"
      style={{
        flex: 1,
        background: 'var(--accent-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        minHeight: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <AnimatePresence mode="wait">
        {config ? (
          <motion.div
            key={`${niche}-${subNiche || 'default'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            style={{
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              borderRadius: 12,
              boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
              border: '1px solid var(--border)',
              background: '#fff',
            }}
          >
            <DataGridPreview config={config} />
          </motion.div>
        ) : (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ width: '100%', height: '100%' }}
          >
            <SkeletonPreview />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default NichePreviewPanel
