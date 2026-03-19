import React, { useState } from 'react'
import { ListTodo, X } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { TaskCard } from '../../molecules/TaskCard/TaskCard'
import type { Task } from '../TaskList/TaskList'
import { t } from '../../../locales/en'

export type TaskScope = 'all' | 'this-chat'

export interface TaskBarProps {
  tasks: Task[]
  isOpen: boolean
  onClose?: () => void
  activeConversationId?: string
  scope?: TaskScope
  onScopeChange?: (scope: TaskScope) => void
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  onViewLogs?: (id: string) => void
  onTaskClick?: (id: string) => void
}

const STATUS_ORDER: Record<string, number> = {
  running: 0,
  pending: 1,
  failed: 2,
  cancelled: 3,
  completed: 4,
}

export function TaskBar({
  tasks,
  isOpen,
  onClose,
  activeConversationId,
  scope: scopeProp,
  onScopeChange,
  onCancel,
  onRetry,
  onViewLogs,
  onTaskClick,
}: TaskBarProps) {
  const [internalScope, setInternalScope] = useState<TaskScope>('all')
  const scope = scopeProp ?? internalScope

  const handleScopeChange = (s: TaskScope) => {
    setInternalScope(s)
    onScopeChange?.(s)
  }

  const visibleTasks = scope === 'this-chat' && activeConversationId
    ? tasks.filter((task) => task.conversationId === activeConversationId)
    : tasks

  const sortedTasks = [...visibleTasks].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
  )

  return (
    <div
      style={{
        width: isOpen ? 320 : 0,
        minWidth: isOpen ? 320 : 0,
        overflow: 'hidden',
        borderLeft: isOpen ? '1px solid var(--border)' : 'none',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s, min-width 0.2s',
        flexShrink: 0,
      }}
    >
      {isOpen && (
        <>
          {/* Header */}
          <div
            style={{
              padding: '0 16px',
              height: 52,
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ListTodo size={16} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {t.taskBar.title}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close task bar"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Scope toggle */}
          {activeConversationId && (
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: '8px 16px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              {(['all', 'this-chat'] as const).map((s) => {
                const isActive = scope === s
                return (
                  <button
                    key={s}
                    onClick={() => handleScopeChange(s)}
                    aria-pressed={isActive}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 14,
                      border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: isActive ? 'var(--accent)' : 'transparent',
                      color: isActive ? '#fff' : 'var(--text-muted)',
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.1s',
                    }}
                  >
                    {s === 'all' ? t.taskBar.scopeAll : t.taskBar.scopeThisChat}
                  </button>
                )
              })}
            </div>
          )}

          {/* Body */}
          {sortedTasks.length === 0 ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                textAlign: 'center',
              }}
            >
              <div>
                <ListTodo size={32} style={{ color: 'var(--border)', marginBottom: 12 }} />
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {t.taskBar.empty}
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
              <ScrollArea.Viewport style={{ height: '100%' }}>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sortedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      {...task}
                      onClick={onTaskClick ? () => onTaskClick(task.id) : undefined}
                      onCancel={onCancel ? () => onCancel(task.id) : undefined}
                      onRetry={onRetry ? () => onRetry(task.id) : undefined}
                      onViewLogs={onViewLogs ? () => onViewLogs(task.id) : undefined}
                    />
                  ))}
                </div>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar orientation="vertical" style={{ width: 4, padding: 1 }}>
                <ScrollArea.Thumb style={{ background: 'var(--border)', borderRadius: 2 }} />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          )}
        </>
      )}
    </div>
  )
}

export default TaskBar
