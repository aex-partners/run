import { useTranslation } from 'react-i18next'
import { BellRing, Check, Clock } from 'lucide-react'
import { trpc } from '../../../platform/trpc'
import { useAuth } from '../../auth/useAuth'
import { Button } from '../../../shared/ui/Button/Button'
import { Badge } from '../../../shared/ui/Badge/Badge'

export interface ReminderCardProps {
  taskId: string
  /** Fallback title from the message metadata; live title comes from the task. */
  title: string
}

/** Next occurrence of the given hour (local time), today if still ahead else tomorrow. */
function nextAt(hour: number): Date {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1)
  return d
}

/**
 * Interactive in-chat reminder. Reads live task state by id and offers snooze
 * presets + acknowledge while the current user is an assignee and the reminder
 * is still open. Renders nothing (the plain system message stays) when the task
 * is invisible to the user or they are not an assignee, so isolation holds.
 */
export function ReminderCard({ taskId }: ReminderCardProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const utils = trpc.useUtils()

  const taskQuery = trpc.tasks.getById.useQuery({ id: taskId })
  const snoozeMut = trpc.tasks.snooze.useMutation({
    onSuccess: () => utils.tasks.getById.invalidate({ id: taskId }),
  })
  const ackMut = trpc.tasks.acknowledge.useMutation({
    onSuccess: () => {
      utils.tasks.getById.invalidate({ id: taskId })
      utils.tasks.list.invalidate()
    },
  })

  const task = taskQuery.data
  // Hide the card (leave the plain system text) when the reminder is not
  // visible to this user or they are not one of its assignees.
  if (!task || !user?.id || !task.assigneeIds.includes(user.id)) return null

  const closed = task.status === 'acknowledged' || task.status === 'cancelled'
  const busy = snoozeMut.isPending || ackMut.isPending

  if (closed) {
    return (
      <div
        role="region"
        aria-label={t('chat.reminderCard.label')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'var(--surface-2)',
          borderRadius: 8,
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--success)',
          maxWidth: 420,
        }}
      >
        <Check size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: 'var(--text)' }}>{task.title}</span>
        <Badge variant={task.status === 'cancelled' ? 'neutral' : 'success'} size="sm">
          {task.status === 'cancelled' ? t('chat.reminderCard.cancelled') : t('chat.reminderCard.done')}
        </Badge>
      </div>
    )
  }

  const presets: Array<{ key: string; label: string; until: () => Date }> = [
    { key: '10m', label: t('chat.reminderCard.snooze10m'), until: () => new Date(Date.now() + 10 * 60_000) },
    { key: '1h', label: t('chat.reminderCard.snooze1h'), until: () => new Date(Date.now() + 60 * 60_000) },
    { key: '3h', label: t('chat.reminderCard.snooze3h'), until: () => new Date(Date.now() + 3 * 60 * 60_000) },
    { key: 'tomorrow', label: t('chat.reminderCard.snoozeTomorrow'), until: () => nextAt(9) },
  ]

  return (
    <div
      role="region"
      aria-label={t('chat.reminderCard.label')}
      style={{
        padding: '12px 14px',
        background: 'var(--surface-2)',
        borderRadius: 8,
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--accent)',
        maxWidth: 420,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <BellRing size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.5 }}>
          {task.title}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Clock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('chat.reminderCard.snoozeLabel')}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {presets.map((p) => (
          <Button
            key={p.key}
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => snoozeMut.mutate({ id: taskId, until: p.until().toISOString() })}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <Button
        variant="primary"
        size="sm"
        disabled={busy}
        onClick={() => ackMut.mutate({ id: taskId })}
      >
        {t('chat.reminderCard.acknowledge')}
      </Button>
    </div>
  )
}

export default ReminderCard
