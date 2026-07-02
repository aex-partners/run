import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { ListSkills } from '@/contexts/skills/application/ports/in/ListSkills'
import { GetSkill } from '@/contexts/skills/application/ports/in/GetSkill'
import { CreateSkill } from '@/contexts/skills/application/ports/in/CreateSkill'
import { UpdateSkill } from '@/contexts/skills/application/ports/in/UpdateSkill'
import { DeleteSkill } from '@/contexts/skills/application/ports/in/DeleteSkill'

export interface SkillControllerDeps {
  list: ListSkills
  getById: GetSkill
  create: CreateSkill
  update: UpdateSkill
  delete: DeleteSkill
}

// Shared input shape for create/update, ported 1:1 from the AEX `skillsRouter`
// `skillInput`. `update` reuses it via `.partial()`.
const skillInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  systemPrompt: z.string().min(1),
  toolIds: z.array(z.string()).default([]),
  systemToolNames: z.array(z.string()).default([]),
  guardrails: z
    .object({
      maxSteps: z.number().optional(),
      blockedTools: z.array(z.string()).optional(),
      requireConfirmation: z.boolean().optional(),
    })
    .default({}),
})

// Driving adapter (tRPC). Ports the AEX `skillsRouter` 1:1: same zod shapes, same
// procedure names, reads as `.query` / writes as `.mutation`. `createdBy` is
// server-authoritative, injected from the protected-procedure context
// (`ctx.user.id`, AEX's `ctx.session.user.id`). Holds no logic of its own.
export const skillController = (deps: SkillControllerDeps) =>
  router({
    list: protectedProcedure.query(() => deps.list.execute()),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => deps.getById.execute({ id: input.id })),

    create: protectedProcedure.input(skillInput).mutation(async ({ ctx, input }) =>
      unwrap(
        await deps.create.execute({
          name: input.name,
          description: input.description ?? null,
          systemPrompt: input.systemPrompt,
          toolIds: input.toolIds,
          systemToolNames: input.systemToolNames,
          guardrails: input.guardrails,
          createdBy: ctx.user.id,
        }),
      ),
    ),

    update: protectedProcedure
      .input(z.object({ id: z.string() }).merge(skillInput.partial()))
      .mutation(async ({ input }) => unwrap(await deps.update.execute(input))),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.delete.execute({ id: input.id }))),
  })
