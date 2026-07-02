import { TaskLog } from '@/contexts/tasks/domain/TaskLog'
import { TaskLogId } from '@/contexts/tasks/domain/ids'

// Driven port. Append-only audit trail per task. The runner writes a log for
// every budget decision and lifecycle marker. `append` must never throw in a way
// that breaks task execution (the adapter swallows logging faults, mirroring
// AEX's "logging must never break task execution").
export interface TaskLogRepository {
  nextId(): TaskLogId
  append(log: TaskLog): Promise<void>
}
