import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { TaskList, type Task } from '../../organisms/TaskList/TaskList'

export interface FilterItem {
  id: string
  label: string
  count?: number
  indent?: boolean
  isHeader?: boolean
}

export interface TasksScreenProps {
  tasks: Task[]
  filters: FilterItem[]
  activeFilter?: string
  onFilterChange?: (filterId: string) => void
  runningCount?: number
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  onViewLogs?: (id: string) => void
}

export function TasksScreen({
  tasks,
  filters,
  activeFilter: initialFilter = 'all',
  onFilterChange,
  runningCount,
  onCancel,
  onRetry,
  onViewLogs,
}: TasksScreenProps) {
  const { t } = useTranslation()
  const [activeFilter, setActiveFilter] = useState(initialFilter)
  const [searchQuery, setSearchQuery] = useState('')

  const handleFilterChange = (id: string) => {
    setActiveFilter(id)
    onFilterChange?.(id)
  }

  const running = tasks.filter((t) => t.status === 'running')
  const pending = tasks.filter((t) => t.status === 'pending')
  const failed = tasks.filter((t) => t.status === 'failed')

  const activeFilterItem = filters.find((f) => f.id === activeFilter)
  const isAgentFilter = activeFilterItem?.indent === true

  // Pre-filter tasks by sidebar filter, then by search query
  const visibleTasks = useMemo(() => {
    let filtered: Task[]
    if (isAgentFilter && activeFilterItem) filtered = tasks.filter((t) => t.agent === activeFilterItem.label)
    else if (activeFilter === 'running') filtered = tasks.filter((t) => t.status === 'running')
    else if (activeFilter === 'completed') filtered = tasks.filter((t) => t.status === 'completed')
    else if (activeFilter === 'failed') filtered = tasks.filter((t) => t.status === 'failed')
    else if (activeFilter === 'pending') filtered = tasks.filter((t) => t.status === 'pending')
    else if (activeFilter === 'cancelled') filtered = tasks.filter((t) => t.status === 'cancelled')
    else filtered = tasks

    if (!searchQuery.trim()) return filtered

    const q = searchQuery.toLowerCase()
    return filtered.filter((task) =>
      task.title.toLowerCase().includes(q) ||
      (task.description && task.description.toLowerCase().includes(q))
    )
  }, [tasks, activeFilter, isAgentFilter, activeFilterItem, searchQuery])

  const headerTitle = activeFilterItem && !activeFilterItem.isHeader
    ? activeFilterItem.label
    : t('tasks.allTasks')

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
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
            padding: '16px 12px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>{t('tasks.title')}</span>
        </div>

        <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
          <ScrollArea.Viewport style={{ height: '100%', padding: '8px 0' }}>
            {filters.map((filter) => {
              if (filter.isHeader) {
                return (
                  <div key={filter.id} style={{ padding: '12px 12px 4px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {filter.label}
                    </span>
                  </div>
                )
              }
              return (
                <button
                  key={filter.id}
                  onClick={() => handleFilterChange(filter.id)}
                  aria-current={activeFilter === filter.id ? 'true' : undefined}
                  style={{
                    width: '100%',
                    padding: filter.indent ? '6px 12px 6px 24px' : '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: activeFilter === filter.id ? 'var(--accent-light)' : 'transparent',
                    border: 'none',
                    borderLeft: activeFilter === filter.id ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                    fontFamily: 'inherit',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: activeFilter === filter.id ? 'var(--accent)' : 'var(--text)',
                      fontWeight: activeFilter === filter.id ? 500 : 400,
                    }}
                  >
                    {filter.label}
                  </span>
                  {filter.count !== undefined && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        background: 'var(--surface-2)',
                        padding: '1px 6px',
                        borderRadius: 10,
                      }}
                    >
                      {filter.count}
                    </span>
                  )}
                </button>
              )
            })}
          </ScrollArea.Viewport>
        </ScrollArea.Root>

        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <div
            style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }}
            aria-label={t('tasks.runningTasksCount')}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {t('tasks.runningNow', { count: runningCount ?? running.length })}
          </span>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          style={{
            padding: '0 20px',
            height: 52,
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 15 }}>{headerTitle}</span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            flex: 1,
            maxWidth: 320,
            marginLeft: 16,
          }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('tasks.searchPlaceholder')}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                color: 'var(--text)',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-muted)' }}
                aria-label={t('clear')}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { status: 'running' as const, count: running.length, color: 'var(--accent)' },
              { status: 'pending' as const, count: pending.length, color: 'var(--warning)' },
              { status: 'failed' as const, count: failed.length, color: 'var(--danger)' },
            ].map(({ status, count, color }) => (
              <div
                key={status}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: `${color}15`,
                  border: `1px solid ${color}30`,
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 12, color, fontWeight: 500 }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        <TaskList tasks={visibleTasks} onCancel={onCancel} onRetry={onRetry} onViewLogs={onViewLogs} />
      </div>
    </div>
  )
}

export default TasksScreen
