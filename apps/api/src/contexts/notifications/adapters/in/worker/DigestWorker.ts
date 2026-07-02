import { RunDigest } from '@/contexts/notifications/application/ports/in/RunDigest'

// Driving adapter. A BullMQ worker is just ANOTHER caller of the RunDigest
// in-port — symmetric to the HTTP controller. The daily schedule (BullMQ repeat
// pattern "0 6 * * *" over Redis) sits behind a Scheduler out-port wired in main;
// here we expose only the job handler.
export const makeDigestJobHandler = (deps: { runDigest: RunDigest }) => {
  return async () => {
    const r = await deps.runDigest.execute()
    if (!r.ok) throw new Error(`digest job failed: ${r.error}`)
    return r.value
  }
}
