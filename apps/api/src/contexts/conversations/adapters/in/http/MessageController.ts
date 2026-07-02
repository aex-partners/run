import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { AppendMessage } from '@/contexts/conversations/application/ports/in/AppendMessage'
import { ForwardMessages } from '@/contexts/conversations/application/ports/in/ForwardMessages'
import { PinMessage } from '@/contexts/conversations/application/ports/in/PinMessage'
import { StarMessage } from '@/contexts/conversations/application/ports/in/StarMessage'
import { ReactToMessage } from '@/contexts/conversations/application/ports/in/ReactToMessage'
import { DeleteMessagesForEveryone } from '@/contexts/conversations/application/ports/in/DeleteMessagesForEveryone'
import { DeleteMessagesForMe } from '@/contexts/conversations/application/ports/in/DeleteMessagesForMe'
import { EditTranscription } from '@/contexts/conversations/application/ports/in/EditTranscription'
import { MarkQuickReplyAnswered } from '@/contexts/conversations/application/ports/in/MarkQuickReplyAnswered'
import { ListMessages } from '@/contexts/conversations/application/queries/ListMessages'

export interface MessageControllerDeps {
  listMessages: ListMessages
  append: AppendMessage
  forward: ForwardMessages
  pin: PinMessage
  star: StarMessage
  react: ReactToMessage
  deleteForEveryone: DeleteMessagesForEveryone
  deleteForMe: DeleteMessagesForMe
  editTranscription: EditTranscription
  markQuickReplyAnswered: MarkQuickReplyAnswered
}

const replyToSchema = z.object({ id: z.string(), author: z.string(), content: z.string() })
const attachmentSchema = z.object({
  fileId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.string(),
  kind: z.enum(['image', 'file']),
})

// Driving adapter (tRPC). Ports the AEX `messagesRouter` 1:1 (11 procedures).
// `send` and `sendAudio` both route through the generic AppendMessage in-port
// (membership-guarded). Holds no logic.
export const messageController = (deps: MessageControllerDeps) =>
  router({
    list: protectedProcedure
      .input(
        z.object({
          conversationId: z.string(),
          cursor: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
        }),
      )
      .query(({ ctx, input }) =>
        deps.listMessages.execute({
          conversationId: input.conversationId,
          userId: ctx.user.id,
          cursor: input.cursor,
          limit: input.limit,
        }),
      ),

    send: protectedProcedure
      .input(
        z.object({
          conversationId: z.string(),
          content: z.string().default(''),
          role: z.enum(['user', 'ai', 'system']).default('user'),
          replyTo: replyToSchema.optional(),
          attachments: z.array(attachmentSchema).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.append.execute({
            conversationId: input.conversationId,
            authorId: ctx.user.id,
            content: input.content,
            role: input.role,
            replyTo: input.replyTo,
            attachments: input.attachments,
            requireMembership: true,
          }),
        ),
      ),

    markQuickReplyAnswered: protectedProcedure
      .input(z.object({ messageId: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.markQuickReplyAnswered.execute({ messageId: input.messageId }))),

    pin: protectedProcedure
      .input(z.object({ messageId: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.pin.execute({ messageId: input.messageId, userId: ctx.user.id })),
      ),

    star: protectedProcedure
      .input(z.object({ messageId: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.star.execute({ messageId: input.messageId, userId: ctx.user.id })),
      ),

    deleteForEveryone: protectedProcedure
      .input(z.object({ messageIds: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.deleteForEveryone.execute({ userId: ctx.user.id, messageIds: input.messageIds })),
      ),

    deleteForMe: protectedProcedure
      .input(z.object({ messageIds: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.deleteForMe.execute({ userId: ctx.user.id, messageIds: input.messageIds })),
      ),

    react: protectedProcedure
      .input(z.object({ messageId: z.string(), emoji: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.react.execute({ messageId: input.messageId, userId: ctx.user.id, emoji: input.emoji })),
      ),

    forward: protectedProcedure
      .input(z.object({ messageIds: z.array(z.string()), recipientConversationIds: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.forward.execute({
            actorId: ctx.user.id,
            messageIds: input.messageIds,
            recipientConversationIds: input.recipientConversationIds,
          }),
        ),
      ),

    sendAudio: protectedProcedure
      .input(
        z.object({
          conversationId: z.string(),
          audioUrl: z.string(),
          duration: z.string(),
          waveform: z.array(z.number()).optional(),
          transcription: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.append.execute({
            conversationId: input.conversationId,
            authorId: ctx.user.id,
            content: input.transcription || '[Audio message]',
            role: 'user',
            audio: {
              url: input.audioUrl,
              duration: input.duration,
              waveform: input.waveform,
              transcription: input.transcription,
            },
            requireMembership: true,
          }),
        ),
      ),

    editTranscription: protectedProcedure
      .input(z.object({ messageId: z.string(), transcription: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.editTranscription.execute({
            messageId: input.messageId,
            userId: ctx.user.id,
            transcription: input.transcription,
          }),
        ),
      ),
  })
