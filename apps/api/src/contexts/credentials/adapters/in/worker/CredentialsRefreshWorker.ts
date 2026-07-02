import { RefreshCredential } from '@/contexts/credentials/application/ports/in/RefreshCredential'

// Driving adapter. A BullMQ worker is just ANOTHER caller of the RefreshCredential
// in-port — symmetric to the HTTP controller. Scheduling is the Scheduler
// out-port (adapters/out/queue); here we expose the job handler the worker runs
// when the weekly job fires. No id in the job data → refresh every due oauth2
// credential.
export const makeCredentialsRefreshJobHandler = (deps: { refresh: RefreshCredential }) => {
  return async () => {
    const r = await deps.refresh.execute({})
    if (!r.ok) throw new Error(`credentials refresh job failed: ${r.error}`)
    return r.value
  }
}
