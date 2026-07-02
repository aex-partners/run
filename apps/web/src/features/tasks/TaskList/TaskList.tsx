import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ListTodo } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { TaskCard, type TaskStatus } from '../TaskCard/TaskCard'
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState'

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
  executor?: 'ai' | 'human'
  kind?: 'task' | 'reminder' | 'approval'
  createdBy?: string
  assigneeIds?: string[]
  canAcknowledge?: boolean
}

export interface TaskListProps {
  tasks: Task[]
  filter?: TaskStatus | 'all'
  onFilterChange?: (filter: TaskStatus | 'all') => void
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  onViewLogs?: (id: string) => void
  onAcknowledge?: (id: string) => void
  onSnooze?: (id: string) => void
}

export type FilterOption = TaskStatus | 'all'

function TaskGroup({
  title,
  tasks,
  color,
  onCancel,
  onRetry,
  onViewLogs,
  onAcknowledge,
  onSnooze,
}: {
  title: string
  tasks: Task[]
  color: string
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  onViewLogs?: (id: string) => void
  onAcknowledge?: (id: string) => void
  onSnooze?: (id: string) => void
}) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  if (!tasks.length) return null

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-label={t('taskList.groupAriaLabel', { title, count: tasks.length })}
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
              executor={task.executor}
              onCancel={onCancel ? () => onCancel(task.id) : undefined}
              onRetry={onRetry ? () => onRetry(task.id) : undefined}
              onViewLogs={onViewLogs ? () => onViewLogs(task.id) : undefined}
              onAcknowledge={onAcknowledge ? () => onAcknowledge(task.id) : undefined}
              onSnooze={onSnooze ? () => onSnooze(task.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function TaskList({ tasks, onCancel, onRetry, onViewLogs, onAcknowledge, onSnooze }: TaskListProps) {
  const { t } = useTranslation()

  // Status filtering lives in the Tasks sidebar (single source of truth); this
  // list just groups whatever it is handed. The old in-list chip row duplicated
  // the sidebar's status filters (cards + sidebar + chips = triple status UI).
  const filteredTasks = tasks
  const running = filteredTasks.filter((t) => t.status === 'running')
  const pending = filteredTasks.filter((t) => t.status === 'pending')
  const failed = filteredTasks.filter((t) => t.status === 'failed')
  const cancelled = filteredTasks.filter((t) => t.status === 'cancelled')
  const completed = filteredTasks.filter((t) => t.status === 'completed')
  const acknowledged = filteredTasks.filter((t) => t.status === 'acknowledged')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Status filter chips removed: status filtering is owned by the Tasks sidebar. */}
      <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport style={{ height: '100%', paddingBottom: 20 }}>
          {filteredTasks.length === 0 ? (
            <EmptyState
              icon={<ListTodo size={22} />}
              title={t('taskList.noTasksFound')}
              description={t('taskList.noTasksDescription', { defaultValue: 'Tarefas que você ou os agentes criarem aparecem aqui. Crie uma para começar.' })}
            />
          ) : (
            <>
              <TaskGroup title={t('tasks.running')} tasks={running} color="var(--accent)" onCancel={onCancel} onRetry={onRetry} onViewLogs={onViewLogs} onAcknowledge={onAcknowledge} onSnooze={onSnooze} />
              <TaskGroup title={t('tasks.pending')} tasks={pending} color="var(--warning)" onCancel={onCancel} onRetry={onRetry} onViewLogs={onViewLogs} onAcknowledge={onAcknowledge} onSnooze={onSnooze} />
              <TaskGroup title={t('tasks.failed')} tasks={failed} color="var(--danger)" onCancel={onCancel} onRetry={onRetry} onViewLogs={onViewLogs} onAcknowledge={onAcknowledge} onSnooze={onSnooze} />
              <TaskGroup title={t('tasks.cancelled')} tasks={cancelled} color="var(--text-muted)" onCancel={onCancel} onRetry={onRetry} onViewLogs={onViewLogs} onAcknowledge={onAcknowledge} onSnooze={onSnooze} />
              <TaskGroup title={t('tasks.done')} tasks={acknowledged} color="var(--success)" onCancel={onCancel} onRetry={onRetry} onViewLogs={onViewLogs} onAcknowledge={onAcknowledge} onSnooze={onSnooze} />
              <TaskGroup title={t('tasks.completedToday')} tasks={completed} color="var(--success)" onCancel={onCancel} onRetry={onRetry} onViewLogs={onViewLogs} onAcknowledge={onAcknowledge} onSnooze={onSnooze} />
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
