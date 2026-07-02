import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { Json, JsonObject } from '@/shared/domain/Json'
import { ListCredentials } from '@/contexts/credentials/application/ports/in/ListCredentials'
import { CreateCredential } from '@/contexts/credentials/application/ports/in/CreateCredential'
import { UpdateCredential } from '@/contexts/credentials/application/ports/in/UpdateCredential'
import { DeleteCredential } from '@/contexts/credentials/application/ports/in/DeleteCredential'
import { StartOAuth } from '@/contexts/credentials/application/ports/in/StartOAuth'
import { CompleteOAuth } from '@/contexts/credentials/application/ports/in/CompleteOAuth'

// Arbitrary JSON validator whose inferred type matches the JsonObject boundary
// the in-ports accept (the source router used `z.record(z.unknown())`).
const jsonValue: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
)
const jsonObject: z.ZodType<JsonObject> = z.record(jsonValue)

// Driving adapter (tRPC). Native typed router mirroring the source credentials
// router: list / create / update / delete / getOAuth2Url. Reads are `.query`,
// writes `.mutation`. The owner `userId` is taken from `ctx.user.id`; Results are
// unwrapped into a value or a tRPC error. Holds no logic.
export const credentialController = (deps: {
  list: ListCredentials
  create: CreateCredential
  update: UpdateCredential
  remove: DeleteCredential
  startOAuth: StartOAuth
}) =>
  router({
    // Read path goes straight to the query — value is already masked there.
    list: protectedProcedure.query(({ ctx }) => deps.list.execute({ userId: ctx.user.id })),

    // Same masked read, filtered to a single plugin's credentials.
    getByPlugin: protectedProcedure
      .input(z.object({ pluginName: z.string() }))
      .query(({ ctx, input }) =>
        deps.list.execute({ userId: ctx.user.id, pluginName: input.pluginName }),
      ),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          pluginName: z.string().min(1),
          type: z.enum(['oauth2', 'secret_text', 'basic_auth', 'custom_auth']),
          value: jsonObject,
        }),
      )
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.create.execute({
            userId: ctx.user.id,
            name: input.name,
            pluginName: input.pluginName,
            type: input.type,
            value: input.value,
          }),
        ),
      ),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(1).optional(),
          value: jsonObject.optional(),
          status: z.enum(['active', 'error', 'missing']).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.update.execute({
            id: input.id,
            userId: ctx.user.id,
            name: input.name,
            value: input.value,
            status: input.status,
          }),
        ),
      ),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.remove.execute({ id: input.id, userId: ctx.user.id })),
      ),

    // Source `getOAuth2Url`: returns the provider authorization URL to redirect to.
    getOAuth2Url: protectedProcedure
      .input(z.object({ pluginName: z.string(), clientId: z.string(), clientSecret: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.startOAuth.execute({
            userId: ctx.user.id,
            pluginName: input.pluginName,
            clientId: input.clientId,
            clientSecret: input.clientSecret,
          }),
        ),
      ),

    // Alias of `getOAuth2Url` (same StartOAuth in-port) under the shorter name the
    // frontend expects.
    getOAuth: protectedProcedure
      .input(z.object({ pluginName: z.string(), clientId: z.string(), clientSecret: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.startOAuth.execute({
            userId: ctx.user.id,
            pluginName: input.pluginName,
            clientId: input.clientId,
            clientSecret: input.clientSecret,
          }),
        ),
      ),
  })

// The OAuth2 callback is NOT a tRPC procedure — it's a plain HTTP GET route the
// provider redirects the browser to. main mounts it as
// `GET /api/credentials/oauth2/callback?code=...&state=...` on Fastify, calls
// this handler, then issues a redirect to the web UI (success or error). Kept
// here so the credentials context owns its inbound shape.
export const makeCredentialOAuthCallback = (deps: { complete: CompleteOAuth }) => {
  return async (query: { code: string; state: string }) => {
    const r = await deps.complete.execute({ code: query.code, state: query.state })
    if (!r.ok) throw new Error(r.error)
    return r.value
  }
}
