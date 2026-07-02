import { Result } from '@/shared/kernel/Result'

// Driving port. Plain-data command in, plain-data out. This is the in-port behind
// AEX's `createNotification` service: persist a notification and let the event
// fan out over WebSocket.
export interface CreateNotificationCommand {
  userId: string
  kind: string
  title: string
  body?: string | null
  taskId?: string | null
}

export interface CreateNotification {
  execute(cmd: CreateNotificationCommand): Promise<Result<{ id: string }>>
}
