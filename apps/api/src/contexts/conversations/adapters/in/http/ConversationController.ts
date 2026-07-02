import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { CreateConversation } from '@/contexts/conversations/application/ports/in/CreateConversation'
import { EnsureDm } from '@/contexts/conversations/application/ports/in/EnsureDm'
import { EnsureEric } from '@/contexts/conversations/application/ports/in/EnsureEric'
import { AddMember } from '@/contexts/conversations/application/ports/in/AddMember'
import { RenameConversation } from '@/contexts/conversations/application/ports/in/RenameConversation'
import { MarkConversationRead } from '@/contexts/conversations/application/ports/in/MarkConversationRead'
import { ToggleConversationFlag } from '@/contexts/conversations/application/ports/in/ToggleConversationFlag'
import { DeleteConversation } from '@/contexts/conversations/application/ports/in/DeleteConversation'
import { SetConversationAgent } from '@/contexts/conversations/application/ports/in/SetConversationAgent'
import { ListConversations } from '@/contexts/conversations/application/queries/ListConversations'
import { GetConversation } from '@/contexts/conversations/application/queries/GetConversation'

export interface ConversationControllerDeps {
  listConversations: ListConversations
  getConversation: GetConversation
  create: CreateConversation
  ensureDm: EnsureDm
  ensureEric: EnsureEric
  addMember: AddMember
  rename: RenameConversation
  markRead: MarkConversationRead
  toggleFlag: ToggleConversationFlag
  deleteConversation: DeleteConversation
  setAgent: SetConversationAgent
}

// Driving adapter (tRPC). Ports the AEX `conversationsRouter` 1:1 (13 procedures).
// `ctx.user.id` stands in for `ctx.session.user.id`. Validates input, calls the
// in-port/query, unwraps Result into a response or a tRPC error. Holds no logic.
export const conversationController = (deps: ConversationControllerDeps) =>
  router({
    list: protectedProcedure.query(({ ctx }) => deps.listConversations.execute({ userId: ctx.user.id })),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ ctx, input }) => deps.getConversation.execute({ id: input.id, userId: ctx.user.id })),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().optional(),
          type: z.enum(['dm', 'channel', 'ai']).default('ai'),
          memberIds: z.array(z.string()).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.create.execute({
            creatorId: ctx.user.id,
            name: input.name,
            type: input.type,
            memberIds: input.memberIds,
          }),
        ),
      ),

    ensureDm: protectedProcedure
      .input(z.object({ peerUserId: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.ensureDm.execute({ userId: ctx.user.id, peerUserId: input.peerUserId })),
      ),

    ensureEric: protectedProcedure.mutation(async ({ ctx }) =>
      unwrap(await deps.ensureEric.execute({ userId: ctx.user.id })),
    ),

    addMember: protectedProcedure
      .input(z.object({ conversationId: z.string(), userId: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.addMember.execute({
            conversationId: input.conversationId,
            actorId: ctx.user.id,
            userId: input.userId,
          }),
        ),
      ),

    rename: protectedProcedure
      .input(z.object({ id: z.string(), name: z.string().min(1) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.rename.execute({ id: input.id, actorId: ctx.user.id, name: input.name })),
      ),

    markRead: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.markRead.execute({ id: input.id, userId: ctx.user.id })),
      ),

    pin: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const r = unwrap(await deps.toggleFlag.execute({ id: input.id, userId: ctx.user.id, flag: 'pinned' }))
        return { pinned: r.value }
      }),

    favorite: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const r = unwrap(await deps.toggleFlag.execute({ id: input.id, userId: ctx.user.id, flag: 'favorite' }))
        return { favorite: r.value }
      }),

    mute: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const r = unwrap(await deps.toggleFlag.execute({ id: input.id, userId: ctx.user.id, flag: 'muted' }))
        return { muted: r.value }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.deleteConversation.execute({ id: input.id, actorId: ctx.user.id })),
      ),

    setAgent: protectedProcedure
      .input(z.object({ conversationId: z.string(), agentId: z.string().nullable() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.setAgent.execute({
            conversationId: input.conversationId,
            actorId: ctx.user.id,
            agentId: input.agentId,
          }),
        ),
      ),
  })
