// The full lifecycle of a task. Born `pending`; the AI runner moves it to
// `running` then `completed` | `failed`; a user moves it to `cancelled` (from
// pending|running) or `acknowledged` (board ack / approval decided). The last
// four are terminal.
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'acknowledged'

// Audit-log severity levels, mirroring the DB enum.
export type TaskLogLevel = 'info' | 'warn' | 'error' | 'step'

// The decision recorded on an approval-kind task.
export type ApprovalDecision = 'approved' | 'rejected'
