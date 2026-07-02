import { Json } from '@/shared/domain/Json'
import { Result } from '@/shared/kernel/Result'

// In-port for an inbound webhook delivery. Verifies the flow is enabled, published
// and webhook-triggered, then creates a running run and enqueues it. Ports
// `flow-engine/webhook-handler.ts`. The error carries an HTTP status for the
// driving adapter to surface.
export interface WebhookPayload {
  body: Json
  headers: Record<string, string | string[] | undefined>
  queryParams: Record<string, string | string[] | undefined>
}

export interface HandleWebhookCommand {
  flowId: string
  payload: WebhookPayload
}

export interface HandleWebhookError {
  error: string
  status: number
}

export interface HandleWebhook {
  execute(cmd: HandleWebhookCommand): Promise<Result<{ runId: string }, HandleWebhookError>>
}
