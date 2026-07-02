import { FireReminder } from '@/contexts/reminders/application/ports/in/FireReminder'

// Driving adapter. A BullMQ worker is just ANOTHER caller of the FireReminder
// in-port — symmetric to the HTTP controller. Scheduling is the Scheduler
// out-port (adapters/out/queue); here we expose the job handler the worker runs
// when the delayed job fires. The job data carries the reminder id.
export const makeReminderJobHandler = (deps: { fire: FireReminder }) => {
  return async (job: { data: { reminderId: string } }) => {
    const r = await deps.fire.execute({ reminderId: job.data.reminderId })
    if (!r.ok) throw new Error(`reminder job failed: ${r.error}`)
    return r.value
  }
}
