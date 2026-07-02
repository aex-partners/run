import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { Chat, ChatEvent } from '@/contexts/assistant/application/ports/in/Chat'

// Driving adapter (HTTP/SSE). Ports chat-route.ts: streams the Chat in-port's
// events to the browser as Server-Sent Events, and exposes the confirmation
// endpoint that resolves a pending mutating-tool gate. Auth and conversation
// membership are cross-cutting platform concerns injected as `authenticate`
// (mirrors better-auth's getSession + the membership guard); the controller holds
// no domain logic — it only translates the transport.
export interface ChatControllerDeps {
  chat: Chat
  authenticate(req: FastifyRequest): Promise<{ userId: string } | null>
}

function sendSSE(reply: FastifyReply, event: ChatEvent | { type: 'done' }): void {
  try {
    if (event.type === 'done') {
      reply.raw.write('data: [DONE]\n\n')
    } else {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }
  } catch {
    // Client disconnected mid-write.
  }
}

export function registerChatRoutes(app: FastifyInstance, deps: ChatControllerDeps): void {
  // Main chat endpoint: streams the AI response via SSE.
  app.post('/api/chat', async (req, reply) => {
    const auth = await deps.authenticate(req)
    if (!auth) return reply.status(401).send({ error: 'Unauthorized' })

    const { prompt, conversationId } = (req.body ?? {}) as { prompt?: string; conversationId?: string }
    if (!prompt || !conversationId) {
      return reply.status(400).send({ error: 'Missing prompt or conversationId' })
    }

    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    // Drop pending confirmations if the client goes away mid-turn.
    reply.raw.on('close', () => deps.chat.cancel(conversationId))

    try {
      for await (const event of deps.chat.execute({ conversationId, prompt, userId: auth.userId })) {
        sendSSE(reply, event)
      }
    } catch (err) {
      sendSSE(reply, { type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      sendSSE(reply, { type: 'done' })
      reply.raw.end()
    }
  })

  // Tool confirmation endpoint: approve/reject a pending mutating-tool gate.
  app.post('/api/chat/confirm', async (req, reply) => {
    const auth = await deps.authenticate(req)
    if (!auth) return reply.status(401).send({ error: 'Unauthorized' })

    const { toolUseId, allow, conversationId } = (req.body ?? {}) as {
      toolUseId?: string
      allow?: boolean
      conversationId?: string
    }
    if (!toolUseId || typeof allow !== 'boolean' || !conversationId) {
      return reply.status(400).send({ error: 'Missing toolUseId, allow, or conversationId' })
    }

    const found = deps.chat.resolveConfirmation({ toolUseId, allowed: allow, conversationId })
    return reply.send({ ok: found })
  })
}
