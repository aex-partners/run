import { RunTask } from '@/contexts/tasks/application/ports/in/RunTask'

// Driving adapter. A BullMQ worker is just ANOTHER caller of the RunTask in-port
// — symmetric to the HTTP controller. Scheduling is the Scheduler out-port
// (adapters/out/queue); here we expose the job handler the worker runs when a
// task job fires. The job data carries the task id.
export const makeTaskJobHandler = (deps: { run: RunTask }) => {
  return async (job: { data: { taskId: string } }) => {
    const r = await deps.run.execute({ taskId: job.data.taskId })
    if (!r.ok) throw new Error(`task job failed: ${r.error}`)
    return r.value
  }
}
