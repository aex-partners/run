import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { Json } from '@/shared/domain/Json'
import { SetViewPreference } from '@/contexts/data/application/ports/in/SetViewPreference'
import { ManageSavedView } from '@/contexts/data/application/ports/in/ManageSavedView'
import { GetViewPreference } from '@/contexts/data/application/queries/GetViewPreference'
import { ListSavedViews } from '@/contexts/data/application/queries/ListSavedViews'

// JSON value algebra as zod (matches @/shared/domain/Json). View configs and
// filters are arbitrary JSON decided by the web client at runtime.
const jsonValue: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
)
const jsonObject = z.record(jsonValue)

const viewType = z.enum(['table', 'kanban', 'calendar', 'form', 'gallery', 'map', 'pivot'])

// Driving adapter for view-preferences.{get,set} and the saved-views CRUD. The
// acting user (userId/actorId) is read from the authenticated context.
export const viewController = (deps: {
  getPreference: GetViewPreference
  setPreference: SetViewPreference
  listViews: ListSavedViews
  manageView: ManageSavedView
}) =>
  router({
    // view-preferences.get
    get: protectedProcedure
      .input(z.object({ entityId: z.string() }))
      .query(({ ctx, input }) => deps.getPreference.execute({ userId: ctx.user.id, entityId: input.entityId })),

    // view-preferences.set
    set: protectedProcedure
      .input(
        z.object({
          entityId: z.string(),
          activeView: z.string().nullable().optional(),
          config: jsonObject.optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.setPreference.execute({
            userId: ctx.user.id,
            entityId: input.entityId,
            activeView: input.activeView,
            config: input.config,
          }),
        ),
      ),

    // saved-views.list
    listViews: protectedProcedure
      .input(z.object({ entityId: z.string() }))
      .query(({ ctx, input }) => deps.listViews.execute({ entityId: input.entityId, userId: ctx.user.id })),

    // saved-views.create
    createView: protectedProcedure
      .input(
        z.object({
          entityId: z.string(),
          name: z.string().min(1),
          isPublic: z.boolean().optional(),
          viewType: viewType.optional(),
          filters: z.array(jsonValue).optional(),
          config: jsonObject.optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.manageView.execute({ action: 'create', actorId: ctx.user.id, ...input })),
      ),

    // saved-views.update
    updateView: protectedProcedure
      .input(
        z.object({
          viewId: z.string(),
          name: z.string().optional(),
          isPublic: z.boolean().optional(),
          viewType: viewType.optional(),
          filters: z.array(jsonValue).optional(),
          config: jsonObject.optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.manageView.execute({ action: 'update', actorId: ctx.user.id, ...input })),
      ),

    // saved-views.delete
    deleteView: protectedProcedure
      .input(z.object({ viewId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        unwrap(await deps.manageView.execute({ action: 'delete', actorId: ctx.user.id, viewId: input.viewId }))
        return { success: true }
      }),

    // saved-views.clone
    cloneView: protectedProcedure
      .input(z.object({ viewId: z.string(), name: z.string().optional() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.manageView.execute({ action: 'clone', actorId: ctx.user.id, viewId: input.viewId, name: input.name }),
        ),
      ),
  })
