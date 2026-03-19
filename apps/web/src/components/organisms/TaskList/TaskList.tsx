import React, { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { TaskCard, type TaskStatus } from '../../molecules/TaskCard/TaskCard'

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  agent: string
  startTime: string
  duration?: string
  progress?: number
  taskType?: 'inference' | 'structured'
  toolName?: string
  conversationId?: string
}

export interface TaskListProps {
  tasks: Task[]
  filter?: TaskStatus | 'all'
  onFilterChange?: (filter: TaskStatus | 'all') => void
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  onViewLogs?: (id: string) => void
}

export type FilterOption = TaskStatus | 'all'

const FILTER_OPTIONS: { label: string; value: FilterOption }[] = [
  { label: 'All', value: 'all' },
  { label: 'Running', value: 'running' },
  { label: 'Pending', value: 'pending' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Completed', value: 'completed' },
]

function TaskGroup({
  title,
  tasks,
  color,
  onCancel,
  onRetry,
  onViewLogs,
}: {
  title: string
  tasks: Task[]
  color: string
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  onViewLogs?: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  if (!tasks.length) return null

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-label={`${title} tasks, ${tasks.length} item${tasks.length !== 1 ? 's' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 20px',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <ChevronRight
          size={12}
          style={{ transition: 'transform 0.15s', transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)', color }}
        />
        {title}
        <span style={{ fontWeight: 400, color: 'var(--border)', marginLeft: 2 }}>· {tasks.length}</span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              {...task}
              onCancel={onCancel ? () => onCancel(task.id) : undefined}
              onRetry={onRetry ? () => onRetry(task.id) : undefined}
              onViewLogs={onViewLogs ? () => onViewLogs(task.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function TaskList({ tasks, filter: filterProp, onFilterChange, onCancel, onRetry, onViewLogs }: TaskListProps) {
  const [internalFilter, setInternalFilter] = useState<FilterOption>(filterProp ?? 'all')

  const activeFilter = filterProp !== undefined ? filterProp : internalFilter

  function handleFilterClick(value: FilterOption) {
    setInternalFilter(value)
    onFilterChange?.(value)
  }

  const filteredTasks = activeFilter === 'all' ? tasks : tasks.filter((t) => t.status === activeFilter)
  const running = filteredTasks.filter((t) => t.status === 'running')
  const pending = filteredTasks.filter((t) => t.status === 'pending')
  const failed = filteredTasks.filter((t) => t.status === 'failed')
  const cancelled = filteredTasks.filter((t) => t.status === 'cancelled')
  const completed = filteredTasks.filter((t) => t.status === 'completed')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        {FILTER_OPTIONS.map((opt) => {
          const isActive = activeFilter === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => handleFilterClick(opt.value)}
              aria-pressed={isActive}
              style={{
                padding: '3px 10px',
                borderRadius: 12,
                border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.1s',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport style={{ height: '100%', paddingBottom: 20 }}>
          {filteredTasks.length === 0 ? (
            <div
              role="status"
              aria-live="polite"
              style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}
            >
              No tasks found
            </div>
          ) : (
            <>
              <TaskGroup title="Running" tasks={running} color="var(--accent)" onCancel={onCancel} onRetry={onRetry} onViewLogs={onViewLogs} />
              <TaskGroup title="Pending" tasks={pending} color="var(--warning)" onCancel={onCancel} onRetry={onRetry} onViewLogs={onViewLogs} />
              <TaskGroup title="Failed" tasks={failed} color="var(--danger)" onCancel={onCancel} onRetry={onRetry} onViewLogs={onViewLogs} />
              <TaskGroup title="Cancelled" tasks={cancelled} color="var(--text-muted)" onCancel={onCancel} onRetry={onRetry} onViewLogs={onViewLogs} />
              <TaskGroup title="Completed Today" tasks={completed} color="var(--success)" onCancel={onCancel} onRetry={onRetry} onViewLogs={onViewLogs} />
            </>
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" style={{ width: 8 }}>
          <ScrollArea.Thumb style={{ background: 'var(--border)', borderRadius: 4 }} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  )
}

export default TaskList
