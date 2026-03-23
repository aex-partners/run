import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Pause, Play, Trash2 } from 'lucide-react'

export interface WorkflowItemProps {
  name: string
  trigger: string
  status: 'active' | 'paused'
  active?: boolean
  onClick?: () => void
  onToggleStatus?: () => void
  onDelete?: () => void
}

const iconButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  padding: 0,
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--text-muted)',
  flexShrink: 0,
}

export function WorkflowItem({ name, trigger, status, active = false, onClick, onToggleStatus, onDelete }: WorkflowItemProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)

  const showToggle = !!onToggleStatus && (active || hovered)
  const showDelete = !!onDelete && hovered

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
    >
      <button
        onClick={onClick}
        aria-pressed={active}
        style={{
          flex: 1,
          minWidth: 0,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: active ? 'var(--accent-light)' : 'transparent',
          border: 'none',
          borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.1s',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: status === 'active' ? 'var(--success)' : 'var(--border)',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--accent)' : 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {trigger}
          </div>
        </div>
        <ChevronRight
          size={12}
          color="var(--accent)"
          style={{ flexShrink: 0, opacity: active ? 1 : 0 }}
        />
      </button>

      {(showToggle || showDelete) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            paddingRight: 8,
            flexShrink: 0,
          }}
        >
          {showToggle && (
            <button
              style={iconButtonStyle}
              onClick={(e) => { e.stopPropagation(); onToggleStatus?.() }}
              aria-label={status === 'active' ? 'Pause workflow' : 'Resume workflow'}
            >
              {status === 'active' ? <Pause size={11} /> : <Play size={11} />}
            </button>
          )}
          {showDelete && (
            <button
              style={{ ...iconButtonStyle, borderColor: 'var(--danger)', color: 'var(--danger)' }}
              onClick={(e) => { e.stopPropagation(); onDelete?.() }}
              aria-label={t('workflows.deleteWorkflow')}
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default WorkflowItem
