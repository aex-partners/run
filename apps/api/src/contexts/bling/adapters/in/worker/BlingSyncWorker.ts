import { Job } from 'bullmq'
import { SyncBlingMirror } from '@/contexts/bling/application/ports/in/SyncBlingMirror'

// Driving adapter. A BullMQ worker is just ANOTHER caller of the SyncBlingMirror
// in-port — symmetric to the HTTP controller. Scheduling is the driven adapter
// (adapters/out/queue/BullBlingSyncScheduler); here we expose the job handler the
// worker runs. Two producers hit the same queue:
//   * the 6h repeatable job (no data) → full sync of all entities.
//   * the manual "Sincronizar Bling" button (enqueueNow) → data.scope.
// So we read job.data.scope, defaulting to 'all'. The sync is idempotent
// (bling_sync_map content-hash skips unchanged records), so a re-run after an api
// restart resumes safely instead of re-importing everything.
type BlingSyncJobData = { scope?: 'all' | 'categorias' }

export const makeBlingSyncJobHandler = (deps: { sync: SyncBlingMirror }) => {
  return async (job: Job<BlingSyncJobData>) => {
    const scope = job.data?.scope ?? 'all'
    const r = await deps.sync.execute({ scope })
    if (!r.ok) throw new Error(`bling sync job failed: ${r.error}`)
    return r.value
  }
}
