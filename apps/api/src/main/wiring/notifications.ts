// Wiring for the `notifications` context (in-app notifications + daily digest). Two
// ACL bridges: EmailSender -> identity.GetSession (recipient email) + email
// .SendTransactionalEmail (digest), and UserDirectory -> identity.GetUsers. Exposes
// createNotification (the tasks Notifier bridges to it) and runDigest (worker).
import { ok, fail } from '@/shared/kernel/Result'
import { Infra } from '@/main/wiring/infra'
import { AclProviders } from '@/main/wiring/aclProviders'
import { IdentityWiring } from '@/main/wiring/identity'
import { EmailWiring } from '@/main/wiring/email'

import { DrizzleNotificationRepository } from '@/contexts/notifications/adapters/out/persistence/DrizzleNotificationRepository'
import { DrizzleNotificationPreferencesRepository } from '@/contexts/notifications/adapters/out/persistence/DrizzleNotificationPreferencesRepository'
import { DrizzleListNotifications } from '@/contexts/notifications/adapters/out/persistence/DrizzleListNotifications'
import { DrizzleGetPreferences } from '@/contexts/notifications/adapters/out/persistence/DrizzleGetPreferences'
import { DrizzleGetUnreadCount } from '@/contexts/notifications/adapters/out/persistence/DrizzleGetUnreadCount'
import { CreateNotificationService } from '@/contexts/notifications/application/use-cases/CreateNotificationService'
import { MarkReadService } from '@/contexts/notifications/application/use-cases/MarkReadService'
import { MarkAllReadService } from '@/contexts/notifications/application/use-cases/MarkAllReadService'
import { UpdatePreferencesService } from '@/contexts/notifications/application/use-cases/UpdatePreferencesService'
import { RunDigestService } from '@/contexts/notifications/application/use-cases/RunDigestService'
import { notificationController } from '@/contexts/notifications/adapters/in/http/NotificationController'
import { EmailSender } from '@/contexts/notifications/application/ports/out/EmailSender'
import { UserDirectory as NotificationsUserDirectory } from '@/contexts/notifications/application/ports/out/UserDirectory'

type NotificationsDeps = Pick<AclProviders, 'getUsers'> & {
  getSession: IdentityWiring['ports']['getSession']
  sendTransactionalEmail: EmailWiring['ports']['sendTransactionalEmail']
}

export function wireNotifications(infra: Infra, deps: NotificationsDeps) {
  const { db, events, clock } = infra
  const { getUsers, getSession, sendTransactionalEmail } = deps

  const notificationRepo = new DrizzleNotificationRepository(db)
  const notificationPrefsRepo = new DrizzleNotificationPreferencesRepository(db)
  const listNotifications = new DrizzleListNotifications(db)
  const getPreferences = new DrizzleGetPreferences(db)
  const getUnreadCount = new DrizzleGetUnreadCount(db)
  // ACL bridge: notifications EmailSender -> email SendTransactionalEmail (digest).
  const emailSender: EmailSender = {
    sendDigest: async (digest) => {
      const session = await getSession.execute({ userId: digest.userId })
      const to = session.ok && session.value ? session.value.email : null
      if (!to) return fail('no recipient email')
      const r = await sendTransactionalEmail.execute({
        to, template: 'notification-digest',
        data: { name: digest.name, count: digest.count, items: digest.items.map((i) => ({ title: i.title, body: i.body ?? undefined })) },
      })
      return r.ok ? ok(undefined) : fail(r.error)
    },
  }
  const createNotification = new CreateNotificationService(notificationRepo, events, clock)
  const markRead = new MarkReadService(notificationRepo, events, clock)
  const markAllRead = new MarkAllReadService(notificationRepo, clock)
  const updatePreferences = new UpdatePreferencesService(notificationPrefsRepo, clock)
  // ACL bridge: notifications UserDirectory -> identity.GetUsers (recipient name +
  // email for the daily digest).
  const notificationsUserDirectory: NotificationsUserDirectory = {
    byIds: async (ids) => (await getUsers.execute(ids)).map((u) => ({ id: u.id, name: u.name, email: u.email })),
  }
  const runDigest = new RunDigestService(notificationPrefsRepo, notificationRepo, notificationsUserDirectory, emailSender, clock)
  const notificationsCtl = notificationController({
    list: listNotifications, unreadCount: getUnreadCount, markRead, markAllRead, getPreferences, updatePreferences,
  })

  return {
    controller: notificationsCtl,
    ports: { createNotification, runDigest },
  }
}

export type NotificationsWiring = ReturnType<typeof wireNotifications>
