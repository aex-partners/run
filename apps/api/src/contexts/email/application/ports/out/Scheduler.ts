// Driven port for delayed jobs. Snoozing an email schedules a future wake; the
// adapter (BullMQ delayed job) fires at `wakeAt`, and the SnoozeWorker driving
// adapter turns that into a WakeSnoozedEmail call. AEX used a 15-minute cron
// scan; the port models the cleaner per-email delayed job instead.
export interface SnoozeWakeRequest {
  emailId: string
  wakeAt: Date
}

export interface Scheduler {
  scheduleSnoozeWake(request: SnoozeWakeRequest): Promise<void>
}
