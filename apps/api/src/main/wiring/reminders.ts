// Wiring for the `reminders` context. One ACL bridge: ConversationPoster ->
// conversations.PostSystemMessage (a fired reminder posts a system message).
// Exposes fireReminder (the BullMQ reminders worker drives it).
import { Infra } from '@/main/wiring/infra'
import { ConversationsWiring } from '@/main/wiring/conversations'

import { DrizzleReminderRepository } from '@/contexts/reminders/adapters/out/persistence/DrizzleReminderRepository'
import { DrizzleListReminders } from '@/contexts/reminders/adapters/out/persistence/DrizzleListReminders'
import { BullScheduler } from '@/contexts/reminders/adapters/out/queue/BullScheduler'
import { CreateReminderService } from '@/contexts/reminders/application/use-cases/CreateReminderService'
import { CancelReminderService } from '@/contexts/reminders/application/use-cases/CancelReminderService'
import { FireReminderService } from '@/contexts/reminders/application/use-cases/FireReminderService'
import { reminderController } from '@/contexts/reminders/adapters/in/http/ReminderController'
import { ConversationPoster as RemindersConversationPoster } from '@/contexts/reminders/application/ports/out/ConversationPoster'

type RemindersDeps = {
  postSystemMessage: ConversationsWiring['ports']['postSystemMessage']
}

export function wireReminders(infra: Infra, deps: RemindersDeps) {
  const { db, events, clock, redisUrl } = infra
  const { postSystemMessage } = deps

  const reminderRepo = new DrizzleReminderRepository(db)
  const listReminders = new DrizzleListReminders(db)
  const reminderScheduler = new BullScheduler(redisUrl)
  // ACL bridge: reminders ConversationPoster -> conversations PostSystemMessage.
  const remindersPoster: RemindersConversationPoster = {
    post: async (req) => { await postSystemMessage.execute({ conversationId: req.conversationId, content: req.content, authorId: req.userId }) },
  }
  const createReminder = new CreateReminderService(reminderRepo, reminderScheduler, events, clock)
  const cancelReminder = new CancelReminderService(reminderRepo, reminderScheduler, events, clock)
  const fireReminder = new FireReminderService(reminderRepo, remindersPoster, events, clock)
  void createReminder
  const remindersCtl = reminderController({ list: listReminders, cancel: cancelReminder })

  return {
    controller: remindersCtl,
    ports: { fireReminder },
  }
}

export type RemindersWiring = ReturnType<typeof wireReminders>
