import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { Json } from '@/shared/domain/Json'
import { CreateFlow } from '@/contexts/automation/application/ports/in/CreateFlow'
import { UpdateFlow } from '@/contexts/automation/application/ports/in/UpdateFlow'
import { DeleteFlow } from '@/contexts/automation/application/ports/in/DeleteFlow'
import { MoveFlow } from '@/contexts/automation/application/ports/in/MoveFlow'
import { SaveVersion } from '@/contexts/automation/application/ports/in/SaveVersion'
import { PublishVersion } from '@/contexts/automation/application/ports/in/PublishVersion'
import { RestoreVersion } from '@/contexts/automation/application/ports/in/RestoreVersion'
import { TriggerFlow } from '@/contexts/automation/application/ports/in/TriggerFlow'
import { ValidateVersion } from '@/contexts/automation/application/ports/in/ValidateVersion'
import {
  CreateFolder,
  DeleteFolder,
  RenameFolder,
  ReorderFolders,
} from '@/contexts/automation/application/ports/in/Folders'
import { ListFlows } from '@/contexts/automation/application/queries/ListFlows'
import { GetFlow } from '@/contexts/automation/application/queries/GetFlow'
import { ListVersions } from '@/contexts/automation/application/queries/ListVersions'
import { ListRuns } from '@/contexts/automation/application/queries/ListRuns'
import { GetRun } from '@/contexts/automation/application/queries/GetRun'
import { ListFolders } from '@/contexts/automation/application/queries/ListFolders'

// JSON value algebra as zod (matches @/shared/domain/Json). A flow's trigger
// payload is arbitrary JSON.
const jsonValue: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
)

// Driving adapter (HTTP/tRPC). One procedure per AEX `flowsRouter` procedure (all
// 18). It parses input, calls the in-port / query, unwraps Result, and holds no
// logic. The acting user comes from the authenticated ctx. Distinct from the
// skeleton's toy `flowController`; this is the full surface.
export interface AexFlowControllerDeps {
  // commands
  create: CreateFlow
  update: UpdateFlow
  remove: DeleteFlow
  move: MoveFlow
  saveVersion: SaveVersion
  publish: PublishVersion
  restoreVersion: RestoreVersion
  trigger: TriggerFlow
  validateVersion: ValidateVersion
  createFolder: CreateFolder
  deleteFolder: DeleteFolder
  renameFolder: RenameFolder
  reorderFolders: ReorderFolders
  // queries
  list: ListFlows
  getById: GetFlow
  listVersions: ListVersions
  listRuns: ListRuns
  getRun: GetRun
  listFolders: ListFolders
}

export const aexFlowController = (deps: AexFlowControllerDeps) =>
  router({
    // --- flows ---
    list: protectedProcedure.query(() => deps.list.execute()),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const flow = await deps.getById.execute(input)
        if (!flow) throw new TRPCError({ code: 'NOT_FOUND' })
        return flow
      }),

    create: protectedProcedure
      .input(z.object({ displayName: z.string().min(1) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.create.execute({ displayName: input.displayName, createdBy: ctx.user.id })),
      ),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          status: z.enum(['enabled', 'disabled']).optional(),
          folderId: z.string().nullable().optional(),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.update.execute(input))),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.remove.execute(input))),

    moveFlow: protectedProcedure
      .input(z.object({ flowId: z.string(), folderId: z.string().nullable() }))
      .mutation(async ({ input }) => unwrap(await deps.move.execute(input))),

    // --- versions ---
    saveVersion: protectedProcedure
      .input(z.object({ flowId: z.string(), displayName: z.string().min(1), trigger: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.saveVersion.execute(input))),

    // On-demand validation for the builder (inline errors/warnings). Read-only.
    validate: protectedProcedure
      .input(z.object({ trigger: z.string(), publish: z.boolean().optional() }))
      .query(({ input }) => deps.validateVersion.execute(input)),

    publish: protectedProcedure
      .input(z.object({ flowId: z.string(), versionId: z.string() }))
      .mutation(async ({ input }) => {
        const r = await deps.publish.execute(input)
        if (r.ok) return r.value
        const message = typeof r.error === 'string' ? r.error : r.error.message
        const cause = typeof r.error === 'string' ? undefined : { errors: r.error.errors, warnings: r.error.warnings }
        throw new TRPCError({ code: 'BAD_REQUEST', message, cause })
      }),

    listVersions: protectedProcedure
      .input(z.object({ flowId: z.string() }))
      .query(({ input }) => deps.listVersions.execute(input)),

    restoreVersion: protectedProcedure
      .input(z.object({ flowId: z.string(), versionId: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.restoreVersion.execute(input))),

    // --- execution ---
    execute: protectedProcedure
      .input(z.object({ flowId: z.string(), triggerPayload: z.record(jsonValue).optional() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.trigger.execute({
            flowId: input.flowId,
            triggeredBy: ctx.user.id,
            triggerPayload: input.triggerPayload,
          }),
        ),
      ),

    listRuns: protectedProcedure
      .input(z.object({ flowId: z.string().optional(), limit: z.number().optional() }))
      .query(({ input }) => deps.listRuns.execute(input)),

    getRun: protectedProcedure
      .input(z.object({ runId: z.string() }))
      .query(async ({ input }) => {
        const run = await deps.getRun.execute(input)
        if (!run) throw new TRPCError({ code: 'NOT_FOUND' })
        return run
      }),

    // --- folders ---
    listFolders: protectedProcedure.query(() => deps.listFolders.execute()),

    createFolder: protectedProcedure
      .input(z.object({ displayName: z.string().min(1) }))
      .mutation(async ({ input }) => unwrap(await deps.createFolder.execute(input))),

    deleteFolder: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.deleteFolder.execute(input))),

    renameFolder: protectedProcedure
      .input(z.object({ id: z.string(), displayName: z.string().min(1) }))
      .mutation(async ({ input }) => unwrap(await deps.renameFolder.execute(input))),

    reorderFolders: protectedProcedure
      .input(z.object({ folderIds: z.array(z.string()).min(1) }))
      .mutation(async ({ input }) => unwrap(await deps.reorderFolders.execute(input))),
  })
