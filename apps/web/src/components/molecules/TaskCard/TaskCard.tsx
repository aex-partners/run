import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, X, FileText } from 'lucide-react'

export type TaskStatus = 'running' | 'pending' | 'completed' | 'failed' | 'cancelled'

export type TaskType = 'inference' | 'structured'

export interface TaskCardProps {
  id: string
  title: string
  description?: string
  status: TaskStatus
  agent: string
  startTime: string
  duration?: string
  progress?: number
  taskType?: TaskType
  toolName?: string
  onClick?: () => void
  onCancel?: () => void
  onRetry?: () => void
  onViewLogs?: () => void
}

import { Ban } from 'lucide-react'

const statusConfig: Record<TaskStatus, { icon: React.ReactNode; color: string; label: string }> = {
  running: { icon: <RefreshCw size={14} />, color: 'var(--accent)', label: 'Running' },
  completed: { icon: <CheckCircle2 size={14} />, color: 'var(--success)', label: 'Completed' },
  failed: { icon: <XCircle size={14} />, color: 'var(--danger)', label: 'Failed' },
  pending: { icon: <Clock size={14} />, color: 'var(--warning)', label: 'Pending' },
  cancelled: { icon: <Ban size={14} />, color: 'var(--text-muted)', label: 'Cancelled' },
}

const AGENT_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#22c55e', '#6b7280',
]

function getAgentColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length]
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const ghostButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 7px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 5,
  color: 'var(--text-muted)',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 500,
  lineHeight: 1.4,
  flexShrink: 0,
}

export function TaskCard({ title, description, status, agent, startTime, duration, progress, taskType, toolName, onClick, onCancel, onRetry, onViewLogs }: TaskCardProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const config = statusConfig[status]
  const agentColor = getAgentColor(agent)

  const showCancel = status === 'running' && !!onCancel && hovered
  const showRetry = status === 'failed' && !!onRetry
  const showLogs = (status === 'failed' || status === 'completed') && !!onViewLogs

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.1s',
      }}
    >
      <div
        style={{ color: config.color, flexShrink: 0 }}
        aria-label={`Task status: ${status}`}
      >
        {config.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </span>
          {taskType && (
            <span
              style={{
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 500,
                borderRadius: 10,
                background: taskType === 'structured' ? '#eef2ff' : 'var(--accent-light)',
                color: taskType === 'structured' ? '#6366f1' : 'var(--accent)',
                border: `1px solid ${taskType === 'structured' ? '#c7d2fe' : 'var(--accent-border)'}`,
                flexShrink: 0,
              }}
            >
              {taskType === 'structured' ? 'Structured' : 'Inference'}
            </span>
          )}
          {toolName && (
            <span
              style={{
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 500,
                borderRadius: 10,
                background: 'var(--surface-2)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                flexShrink: 0,
              }}
            >
              {toolName}
            </span>
          )}
          {status === 'failed' && <AlertCircle size={12} color="var(--danger)" style={{ flexShrink: 0 }} />}
        </div>

        {description && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {description}
          </div>
        )}

        {status === 'running' && progress !== undefined && (
          <div style={{ marginTop: 6, height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden', maxWidth: 200 }}>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }}
            />
          </div>
        )}
      </div>

      {(showCancel || showRetry || showLogs) && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {showLogs && (
            <button style={ghostButtonStyle} onClick={onViewLogs} aria-label={t('tasks.viewLogs')}>
              <FileText size={11} />
              Logs
            </button>
          )}
          {showRetry && (
            <button style={ghostButtonStyle} onClick={onRetry} aria-label={t('tasks.retryTask')}>
              <RefreshCw size={11} />
              Retry
            </button>
          )}
          {showCancel && (
            <button style={{ ...ghostButtonStyle, borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={onCancel} aria-label={t('tasks.cancelTask')}>
              <X size={11} />
              Cancel
            </button>
          )}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          borderRadius: 12,
          background: `${agentColor}18`,
          border: `1px solid ${agentColor}33`,
          flexShrink: 0,
        }}
      >
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: agentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff' }}>
          {getInitials(agent)}
        </div>
        <span style={{ fontSize: 11, fontWeight: 500, color: agentColor }}>{agent}</span>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{startTime}</div>
        {duration && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{duration}</div>}
      </div>
    </div>
  )
}

export default TaskCard
