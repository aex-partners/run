import { Json } from '@/shared/domain/Json'
import { StartFlow } from '@/contexts/automation/application/ports/in/StartFlow'

// Driving adapter. A BullMQ worker is just ANOTHER caller of the StartFlow
// in-port — symmetric to the HTTP controller. The queue (BullMQ/Redis) sits
// behind a Scheduler out-port elsewhere; here we expose the job handler.
export const makeFlowJobHandler = (deps: { start: StartFlow }) => {
  return async (job: { data: { flowId: string; input: Json } }) => {
    const r = await deps.start.execute(job.data)
    if (!r.ok) throw new Error(`flow job failed: ${r.error}`)
    return r.value
  }
}
