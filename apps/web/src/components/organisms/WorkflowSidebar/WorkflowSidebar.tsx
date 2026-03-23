import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { WorkflowItem } from '../../molecules/WorkflowItem/WorkflowItem'

export interface Workflow {
  id: string
  name: string
  trigger: string
  status: 'active' | 'paused'
}

export interface WorkflowSidebarProps {
  workflows: Workflow[]
  activeId?: string
  onSelect?: (id: string) => void
  onNew?: () => void
  onToggleStatus?: (id: string) => void
  onDelete?: (id: string) => void
}

export function WorkflowSidebar({ workflows: workflowsProp, activeId, onSelect, onNew, onToggleStatus, onDelete }: WorkflowSidebarProps) {
  const { t } = useTranslation()
  const [workflows, setWorkflows] = useState<Workflow[]>(workflowsProp)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    setWorkflows(workflowsProp)
  }, [workflowsProp])

  const filtered = workflows.filter((w) =>
    w.name.toLowerCase().includes(searchText.toLowerCase())
  )

  const active = filtered.filter((w) => w.status === 'active')
  const paused = filtered.filter((w) => w.status === 'paused')

  function handleToggleStatus(id: string) {
    setWorkflows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, status: w.status === 'active' ? 'paused' : 'active' } : w
      )
    )
    onToggleStatus?.(id)
  }

  function handleDelete(id: string) {
    setWorkflows((prev) => prev.filter((w) => w.id !== id))
    onDelete?.(id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          padding: '14px 12px 10px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{t('workflows.title')}</span>
        <button
          onClick={onNew}
          aria-label={t('workflows.createNewWorkflow')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 12,
            cursor: 'pointer',
            fontWeight: 500,
            fontFamily: 'inherit',
          }}
        >
          <Plus size={12} /> New
        </button>
      </div>

      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={12}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 8, pointerEvents: 'none' }}
          />
          <input
            type="text"
            placeholder={t('workflows.searchWorkflows')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label={t('workflows.searchWorkflows')}
            style={{
              width: '100%',
              padding: '5px 8px 5px 26px',
              background: 'var(--surface-2, var(--surface))',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--text)',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <ScrollArea.Root role="region" aria-label={t('workflows.workflowsList')} style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport style={{ height: '100%', padding: '8px 0' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No workflows
            </div>
          ) : (
            <>
              {active.length > 0 && (
                <>
                  <div style={{ padding: '4px 12px 6px' }}>
                    <span
                      role="heading"
                      aria-level={3}
                      style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    >
                      Active
                    </span>
                  </div>
                  {active.map((wf) => (
                    <WorkflowItem
                      key={wf.id}
                      name={wf.name}
                      trigger={wf.trigger}
                      status={wf.status}
                      active={activeId === wf.id}
                      onClick={() => onSelect?.(wf.id)}
                      onToggleStatus={() => handleToggleStatus(wf.id)}
                      onDelete={() => handleDelete(wf.id)}
                    />
                  ))}
                </>
              )}

              {paused.length > 0 && (
                <>
                  <div style={{ padding: '10px 12px 6px' }}>
                    <span
                      role="heading"
                      aria-level={3}
                      style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    >
                      Paused
                    </span>
                  </div>
                  {paused.map((wf) => (
                    <WorkflowItem
                      key={wf.id}
                      name={wf.name}
                      trigger={wf.trigger}
                      status={wf.status}
                      active={activeId === wf.id}
                      onClick={() => onSelect?.(wf.id)}
                      onToggleStatus={() => handleToggleStatus(wf.id)}
                      onDelete={() => handleDelete(wf.id)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" style={{ width: 4 }}>
          <ScrollArea.Thumb style={{ background: 'var(--border)', borderRadius: 2 }} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  )
}

export default WorkflowSidebar
