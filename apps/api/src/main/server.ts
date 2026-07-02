// Fastify bootstrap. Wires the platform pool, Redis, better-auth, the tRPC
// AppRouter, the realtime (ws) + chat (SSE) surfaces, the raw HTTP routes the
// controllers don't cover (auth handler, oauth callback, webhooks, upload), and
// the BullMQ workers. It is OK that this cannot run without Postgres/Redis; the
// composition is what matters.
import Fastify, { FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node'
import type { Worker } from 'bullmq'

import { loadEnv } from '@/platform/config/env'
import { makeDb } from '@/platform/db/client'
import { makeRedis } from '@/platform/queue/connection'
import { makeAuth, resolveSessionUser } from '@/platform/auth/better-auth'
import { AppContext } from '@/platform/http/trpc'
import { buildContainer } from '@/main/container'
import { appRouter } from '@/main/routes'
import { startWorkers } from '@/main/workers'
import { registerChatRoutes } from '@/contexts/assistant/adapters/in/http/ChatController'
import { toWebhookPayload } from '@/contexts/automation/adapters/in/webhook/WebhookReceiver'

async function main() {
  const env = loadEnv()
  const db = makeDb(env.DATABASE_URL)
  const redis = makeRedis(env.REDIS_URL)
  const auth = makeAuth(db, env)
  const container = buildContainer(db, redis, env, auth)

  const app = Fastify({ logger: true, maxParamLength: 5000 })

  // --- platform plugins ---
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true })
  await app.register(cookie)
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(multipart)
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' })
  await app.register(websocket)

  // --- better-auth handler (own scope: pass the raw request through unparsed) ---
  await app.register(async (instance) => {
    // Drop inherited parsers (the global application/json one would consume the
    // body before better-auth reads request.raw) and pass every payload through
    // untouched so toNodeHandler gets the raw stream.
    instance.removeAllContentTypeParsers()
    instance.addContentTypeParser('*', (_req, payload, done) => done(null, payload))
    const authHandler = toNodeHandler(auth)
    instance.all('/api/auth/*', async (request, reply) => {
      reply.hijack()
      await authHandler(request.raw, reply.raw)
    })
  })

  // --- tRPC AppRouter ---
  const router = appRouter(container)
  await app.register(fastifyTRPCPlugin, {
    prefix: '/api/trpc',
    trpcOptions: {
      router,
      createContext: async ({ req }: { req: FastifyRequest }): Promise<AppContext> => {
        const user = await resolveSessionUser(auth, fromNodeHeaders(req.headers))
        return { user: user ? { id: user.id, role: user.role, email: user.email } : null }
      },
    },
  })

  // --- realtime: fan domain events out over websockets ---
  app.get('/ws', { websocket: true }, (socket) => {
    container.events.register(socket)
  })

  // --- assistant chat (SSE) ---
  registerChatRoutes(app, {
    chat: container.http.chat,
    authenticate: async (req: FastifyRequest) => {
      const user = await resolveSessionUser(auth, fromNodeHeaders(req.headers))
      return user ? { userId: user.id } : null
    },
  })

  // --- credentials OAuth2 callback ---
  app.get('/api/credentials/oauth2/callback', async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string }
    if (!code || !state) return reply.code(400).send({ error: 'missing code/state' })
    try {
      const result = await container.http.credentialOAuthCallback({ code, state })
      return reply.redirect(`${env.CORS_ORIGIN}/settings/credentials?connected=${encodeURIComponent(result.pluginName)}`)
    } catch (err) {
      return reply.redirect(`${env.CORS_ORIGIN}/settings/credentials?error=${encodeURIComponent(String(err))}`)
    }
  })

  // --- automation inbound webhook (trigger a flow) ---
  app.post('/api/flows/:id/webhook', async (request) => {
    const params = request.params as { id: string }
    const payload = toWebhookPayload({
      body: (request.body ?? null) as never,
      headers: request.headers,
      query: request.query as Record<string, string | string[] | undefined>,
    })
    return container.http.flowWebhookReceiver(params.id, payload)
  })

  // --- files: multipart upload ---
  app.post('/api/upload/file', async (request, reply) => {
    const user = await resolveSessionUser(auth, fromNodeHeaders(request.headers))
    if (!user) return reply.code(401).send({ error: 'unauthorized' })
    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'no file' })
    const buf = await data.toBuffer()
    const result = await container.http.uploadFile.execute({
      ownerId: user.id,
      name: data.filename,
      bytes: new Uint8Array(buf),
    })
    if (!result.ok) return reply.code(400).send({ error: result.error })
    return result.value
  })

  app.get('/health', async () => ({ ok: true }))

  // --- workers ---
  const workers: Worker[] = await startWorkers(container, redis)

  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  app.log.info(`AEX Run API listening on :${env.PORT}`)

  // --- graceful shutdown ---
  const shutdown = async (signal: string) => {
    app.log.info(`received ${signal}, shutting down`)
    try {
      await app.close()
      await Promise.all(workers.map((w) => w.close()))
      await redis.quit()
    } catch (err) {
      app.log.error(err)
    } finally {
      process.exit(0)
    }
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
