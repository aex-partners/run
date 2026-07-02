import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { SendMessage } from '@/contexts/assistant/application/ports/in/SendMessage'

// Driving adapter (tRPC). Sends a user message into a conversation and returns the
// assistant reply. A write, so it maps to `.mutation`; unwraps Result into a value
// or a tRPC error. Holds no logic of its own.
export const conversationController = (deps: { send: SendMessage }) =>
  router({
    send: protectedProcedure
      .input(z.object({ conversationId: z.string(), text: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.send.execute(input))),
  })
