import { SyncBlingMirror } from '@/contexts/bling/application/ports/in/SyncBlingMirror'

// Driving adapter. A BullMQ worker is just ANOTHER caller of the SyncBlingMirror
// in-port — symmetric to the HTTP controller. Scheduling is the driven adapter
// (adapters/out/queue/BullBlingSyncScheduler); here we expose the job handler the
// worker runs when the 6h repeatable job fires. No job data → full sync of all
// entities.
export const makeBlingSyncJobHandler = (deps: { sync: SyncBlingMirror }) => {
  return async () => {
    const r = await deps.sync.execute({ scope: 'all' })
    if (!r.ok) throw new Error(`bling sync job failed: ${r.error}`)
    return r.value
  }
}
