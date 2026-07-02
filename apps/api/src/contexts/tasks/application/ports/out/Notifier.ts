// ACL (anti-corruption) out-port. When a task is assigned / acknowledged / a
// reminder fires, the tasks context raises a notification. It MUST NOT import the
// notifications context: the composition root bridges this to that context's
// CreateNotification in-port. Declared here as a plain interface only.
export interface NotifyRequest {
  userId: string
  kind: string
  title: string
  taskId?: string | null
  body?: string | null
}

export interface Notifier {
  notify(request: NotifyRequest): Promise<void>
}
