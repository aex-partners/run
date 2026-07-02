import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { Json, JsonObject } from '@/shared/domain/Json'
import { ListPlugins } from '@/contexts/plugins/application/ports/in/ListPlugins'
import { GetPlugin } from '@/contexts/plugins/application/ports/in/GetPlugin'
import { GetPieceCatalog } from '@/contexts/plugins/application/ports/in/GetPieceCatalog'
import { InstallPlugin } from '@/contexts/plugins/application/ports/in/InstallPlugin'
import { UninstallPlugin } from '@/contexts/plugins/application/ports/in/UninstallPlugin'
import { ConfigurePlugin } from '@/contexts/plugins/application/ports/in/ConfigurePlugin'
import { SetPluginEnabled } from '@/contexts/plugins/application/ports/in/SetPluginEnabled'
import { SyncRegistry } from '@/contexts/plugins/application/ports/in/SyncRegistry'
import { ListPieceTools } from '@/contexts/plugins/application/ports/in/ListPieceTools'
import { GetConfigSchema } from '@/contexts/plugins/application/ports/in/GetConfigSchema'
import { GetPieceMetadata } from '@/contexts/plugins/application/ports/in/GetPieceMetadata'

// Arbitrary JSON validator whose inferred type matches the JsonObject boundary
// the in-ports accept (the source router used `z.record(z.unknown())`).
const jsonValue: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
)
const jsonObject: z.ZodType<JsonObject> = z.record(jsonValue)

// Driving adapter (tRPC). Native typed router mirroring the source `plugins`
// router 1:1, all 10 procedures. Reads are `.query`, writes `.mutation`. The
// authenticated installer comes from `ctx.user.id`; Results are unwrapped into a
// value or a tRPC error. Holds no logic of its own.
export const pluginController = (deps: {
  list: ListPlugins
  getById: GetPlugin
  catalog: GetPieceCatalog
  install: InstallPlugin
  uninstall: UninstallPlugin
  configure: ConfigurePlugin
  setEnabled: SetPluginEnabled
  syncRegistry: SyncRegistry
  listPieceTools: ListPieceTools
  getConfigSchema: GetConfigSchema
  pieceMetadata: GetPieceMetadata
}) =>
  router({
    catalog: protectedProcedure.query(() => deps.catalog.execute()),

    list: protectedProcedure.query(() => deps.list.execute()),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => deps.getById.execute({ id: input.id })),

    listPieceTools: protectedProcedure.query(() => deps.listPieceTools.execute()),

    pieceMetadata: protectedProcedure
      .input(z.object({ pieceName: z.string() }))
      .query(({ input }) => deps.pieceMetadata.execute({ pieceName: input.pieceName })),

    install: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.install.execute({ id: input.id, userId: ctx.user.id })),
      ),

    uninstall: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.uninstall.execute({ id: input.id }))),

    configure: protectedProcedure
      .input(z.object({ id: z.string(), config: jsonObject }))
      .mutation(async ({ input }) =>
        unwrap(await deps.configure.execute({ id: input.id, config: input.config })),
      ),

    setEnabled: protectedProcedure
      .input(z.object({ id: z.string(), enabled: z.boolean() }))
      .mutation(async ({ input }) =>
        unwrap(await deps.setEnabled.execute({ id: input.id, enabled: input.enabled })),
      ),

    syncRegistry: protectedProcedure.mutation(async () => unwrap(await deps.syncRegistry.execute())),

    getConfigSchema: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => unwrap(await deps.getConfigSchema.execute({ id: input.id }))),
  })
