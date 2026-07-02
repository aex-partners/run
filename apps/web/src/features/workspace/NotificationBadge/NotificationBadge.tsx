import { useTranslation } from 'react-i18next'
import * as Popover from '@radix-ui/react-popover'
import { Bell, CheckCheck } from 'lucide-react'
import { trpc } from '../../../platform/trpc'

function formatRelative(date: string | Date): string {
  const d = new Date(date)
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  return `${Math.floor(diffH / 24)}d`
}

type NotificationBadgeProps = {
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

export function NotificationBadge({ side = 'bottom', align = 'end' }: NotificationBadgeProps = {}) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const countQuery = trpc.notifications.unreadCount.useQuery()
  const listQuery = trpc.notifications.list.useQuery({ limit: 20 })

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate()
      utils.notifications.list.invalidate()
    },
  })
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate()
      utils.notifications.list.invalidate()
    },
  })

  const count = countQuery.data ?? 0
  const items = listQuery.data ?? []

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          aria-label={t('notifications.title')}
          style={{ position: 'relative', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
        >
          <Bell size={16} />
          {count > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 8,
                background: 'var(--danger)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={8}
          style={{
            width: 320,
            maxHeight: 420,
            overflowY: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
            zIndex: 300,
            padding: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('notifications.title')}</span>
            {count > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11, fontFamily: 'inherit' }}
              >
                <CheckCheck size={12} />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              {t('notifications.empty')}
            </div>
          ) : (
            <div>
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.readAt) markRead.mutate({ id: n.id }) }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    padding: '10px 14px',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    background: n.readAt ? 'transparent' : 'var(--accent-light)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: n.readAt ? 400 : 600, color: 'var(--text)' }}>{n.title}</span>
                  {n.body && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.body}</span>}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatRelative(n.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export default NotificationBadge
