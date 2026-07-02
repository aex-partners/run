import { Json } from '@/shared/domain/Json'
import { HandleWebhook, WebhookPayload } from '@/contexts/automation/application/ports/in/HandleWebhook'

// Driving adapter for inbound webhook deliveries. Framework-agnostic: main mounts
// it on the HTTP route (e.g. POST /api/flows/:flowId/webhook) and maps the result
// to a response. Ports `flow-engine/webhook-handler.ts`'s entrypoint.
export type WebhookResult = { runId: string } | { error: string; status: number }

export const makeWebhookReceiver =
  (handle: HandleWebhook) =>
  async (flowId: string, payload: WebhookPayload): Promise<WebhookResult> => {
    const r = await handle.execute({ flowId, payload })
    if (r.ok) return r.value
    return { error: r.error.error, status: r.error.status }
  }

// Convenience to build the payload from a raw HTTP request shape.
export const toWebhookPayload = (req: {
  body: Json
  headers: Record<string, string | string[] | undefined>
  query: Record<string, string | string[] | undefined>
}): WebhookPayload => ({
  body: req.body,
  headers: req.headers,
  queryParams: req.query,
})
