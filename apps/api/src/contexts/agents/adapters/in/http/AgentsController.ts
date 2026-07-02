import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { ListAgents } from '@/contexts/agents/application/ports/in/ListAgents'
import { GetAgent } from '@/contexts/agents/application/ports/in/GetAgent'
import { CreateAgent } from '@/contexts/agents/application/ports/in/CreateAgent'
import { UpdateAgent } from '@/contexts/agents/application/ports/in/UpdateAgent'
import { DeleteAgent } from '@/contexts/agents/application/ports/in/DeleteAgent'

// Driving adapter (tRPC). Mirrors the source `agents` router 1:1 (list, getById,
// create, update, delete). Validates input with zod, calls the in-ports, unwraps
// Result into a response or a tRPC error. Holds no logic.
const agentInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  avatar: z.string().optional(),
  systemPrompt: z.string().min(1),
  modelId: z.string().nullable().optional(),
  skillIds: z.array(z.string()).default([]),
  toolIds: z.array(z.string()).default([]),
})

export const agentsController = (deps: {
  list: ListAgents
  get: GetAgent
  create: CreateAgent
  update: UpdateAgent
  remove: DeleteAgent
}) =>
  router({
    list: protectedProcedure.query(() => deps.list.execute()),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => deps.get.execute({ id: input.id })),

    create: protectedProcedure.input(agentInput).mutation(async ({ ctx, input }) =>
      unwrap(
        await deps.create.execute({
          actorId: ctx.user.id,
          name: input.name,
          description: input.description,
          avatar: input.avatar,
          systemPrompt: input.systemPrompt,
          modelId: input.modelId,
          skillIds: input.skillIds,
          toolIds: input.toolIds,
        }),
      ),
    ),

    update: protectedProcedure
      .input(z.object({ id: z.string() }).merge(agentInput.partial()))
      .mutation(async ({ input }) =>
        unwrap(
          await deps.update.execute({
            id: input.id,
            name: input.name,
            description: input.description,
            avatar: input.avatar,
            systemPrompt: input.systemPrompt,
            modelId: input.modelId,
            skillIds: input.skillIds,
            toolIds: input.toolIds,
          }),
        ),
      ),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.remove.execute({ id: input.id }))),
  })
