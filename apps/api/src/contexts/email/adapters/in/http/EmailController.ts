import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { CreateAccount, UpdateAccount, DeleteAccount } from '@/contexts/email/application/ports/in/ManageAccount'
import { AddMember, RemoveMember } from '@/contexts/email/application/ports/in/ManageMembers'
import { VerifySmtp, VerifyImap } from '@/contexts/email/application/ports/in/VerifyConnection'
import { Autodiscover } from '@/contexts/email/application/ports/in/Autodiscover'
import { SyncAccount } from '@/contexts/email/application/ports/in/SyncAccount'
import { SendEmail } from '@/contexts/email/application/ports/in/SendEmail'
import { MoveEmails } from '@/contexts/email/application/ports/in/MoveEmails'
import { SetReadState } from '@/contexts/email/application/ports/in/SetReadState'
import { ToggleStar } from '@/contexts/email/application/ports/in/ToggleStar'
import { SnoozeEmail } from '@/contexts/email/application/ports/in/SnoozeEmail'
import { ToggleLabel } from '@/contexts/email/application/ports/in/ToggleLabel'
import { CreateLabel, DeleteLabel } from '@/contexts/email/application/ports/in/ManageLabels'
import {
  CheckAiEnabled,
  GenerateAiSummary,
  GenerateAiDraft,
} from '@/contexts/email/application/ports/in/GenerateAiContent'
import { IsConfigured } from '@/contexts/email/application/queries/IsConfigured'
import { ListAccounts } from '@/contexts/email/application/queries/ListAccounts'
import { GetSmtpDefaults } from '@/contexts/email/application/queries/GetSmtpDefaults'
import { ListEmails } from '@/contexts/email/application/queries/ListEmails'
import { GetEmail } from '@/contexts/email/application/queries/GetEmail'
import { GetThread } from '@/contexts/email/application/queries/GetThread'
import { FolderCounts } from '@/contexts/email/application/queries/FolderCounts'
import { ListLabels } from '@/contexts/email/application/queries/ListLabels'

export interface EmailControllerDeps {
  isConfigured: IsConfigured
  listAccounts: ListAccounts
  getSmtpDefaults: GetSmtpDefaults
  autodiscover: Autodiscover
  createAccount: CreateAccount
  updateAccount: UpdateAccount
  deleteAccount: DeleteAccount
  addMember: AddMember
  removeMember: RemoveMember
  verifySmtp: VerifySmtp
  verifyImap: VerifyImap
  syncAccount: SyncAccount
  sendEmail: SendEmail
  listEmails: ListEmails
  getEmail: GetEmail
  getThread: GetThread
  toggleStar: ToggleStar
  setReadState: SetReadState
  moveEmails: MoveEmails
  snoozeEmail: SnoozeEmail
  toggleLabel: ToggleLabel
  folderCounts: FolderCounts
  listLabels: ListLabels
  createLabel: CreateLabel
  deleteLabel: DeleteLabel
  checkAiEnabled: CheckAiEnabled
  generateAiSummary: GenerateAiSummary
  generateAiDraft: GenerateAiDraft
}

const folderEnum = z.enum(['inbox', 'sent', 'drafts', 'spam', 'trash', 'starred', 'archive'])

// Driving adapter (tRPC). Ports the AEX emailsRouter 1:1: same zod input shapes,
// nested mailAccounts/labels sub-routers, owner scoping from the authenticated
// ctx.user, Result unwrapped into a value or a tRPC error. Holds no logic.
export const emailController = (deps: EmailControllerDeps) =>
  router({
    isConfigured: protectedProcedure.query(({ ctx }) => deps.isConfigured.execute({ userId: ctx.user.id })),

    mailAccounts: router({
      list: protectedProcedure.query(({ ctx }) => deps.listAccounts.execute({ userId: ctx.user.id })),

      getDefaults: protectedProcedure.query(() => deps.getSmtpDefaults.execute()),

      autodiscover: protectedProcedure
        .input(z.object({ email: z.string().email() }))
        .mutation(async ({ input }) => unwrap(await deps.autodiscover.execute(input))),

      create: protectedProcedure
        .input(
          z.object({
            displayName: z.string().min(1),
            emailAddress: z.string().email(),
            fromName: z.string().optional(),
            smtpHost: z.string().min(1),
            smtpPort: z.number().int().min(1).max(65535).default(587),
            smtpUser: z.string().min(1),
            smtpPass: z.string().min(1),
            smtpSecure: z.boolean().default(true),
            imapHost: z.string().optional(),
            imapPort: z.number().int().min(1).max(65535).default(993),
            imapUser: z.string().optional(),
            imapPass: z.string().optional(),
            imapSecure: z.boolean().default(true),
            isShared: z.boolean().default(false),
          }),
        )
        .mutation(async ({ ctx, input }) =>
          unwrap(await deps.createAccount.execute({ ownerId: ctx.user.id, ...input })),
        ),

      update: protectedProcedure
        .input(
          z.object({
            id: z.string(),
            displayName: z.string().min(1).optional(),
            emailAddress: z.string().email().optional(),
            fromName: z.string().optional(),
            smtpHost: z.string().min(1).optional(),
            smtpPort: z.number().int().min(1).max(65535).optional(),
            smtpUser: z.string().min(1).optional(),
            smtpPass: z.string().min(1).optional(),
            smtpSecure: z.boolean().optional(),
            isShared: z.boolean().optional(),
          }),
        )
        .mutation(async ({ ctx, input }) =>
          unwrap(await deps.updateAccount.execute({ actorId: ctx.user.id, ...input })),
        ),

      delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) =>
          unwrap(await deps.deleteAccount.execute({ actorId: ctx.user.id, id: input.id })),
        ),

      addMember: protectedProcedure
        .input(z.object({ accountId: z.string(), userId: z.string(), canSend: z.boolean().default(true) }))
        .mutation(async ({ ctx, input }) =>
          unwrap(await deps.addMember.execute({ actorId: ctx.user.id, ...input })),
        ),

      removeMember: protectedProcedure
        .input(z.object({ accountId: z.string(), userId: z.string() }))
        .mutation(async ({ ctx, input }) =>
          unwrap(await deps.removeMember.execute({ actorId: ctx.user.id, ...input })),
        ),

      verify: protectedProcedure
        .input(
          z.object({
            host: z.string(),
            port: z.number(),
            user: z.string(),
            pass: z.string(),
            from: z.string(),
            secure: z.boolean(),
          }),
        )
        .mutation(async ({ input }) => unwrap(await deps.verifySmtp.execute(input))),

      verifyImap: protectedProcedure
        .input(
          z.object({
            host: z.string(),
            port: z.number(),
            user: z.string(),
            pass: z.string(),
            secure: z.boolean(),
          }),
        )
        .mutation(async ({ input }) => unwrap(await deps.verifyImap.execute(input))),
    }),

    sync: protectedProcedure
      .input(z.object({ accountId: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.syncAccount.execute({ actorId: ctx.user.id, accountId: input.accountId })),
      ),

    send: protectedProcedure
      .input(
        z.object({
          accountId: z.string(),
          to: z.string(),
          cc: z.string().optional(),
          subject: z.string(),
          body: z.string(),
          attachments: z
            .array(
              z.object({
                id: z.string(),
                name: z.string(),
                path: z.string(),
                mimeType: z.string().optional(),
              }),
            )
            .optional(),
          inReplyTo: z.string().optional(),
          threadId: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => unwrap(await deps.sendEmail.execute({ actorId: ctx.user.id, ...input }))),

    list: protectedProcedure
      .input(
        z
          .object({
            accountId: z.string().optional(),
            folder: folderEnum.optional().default('inbox'),
            search: z.string().optional(),
            limit: z.number().min(1).max(100).default(50),
            offset: z.number().min(0).default(0),
          })
          .optional()
          .default({}),
      )
      .query(({ ctx, input }) =>
        deps.listEmails.execute({
          userId: ctx.user.id,
          accountId: input.accountId,
          folder: input.folder,
          search: input.search,
          limit: input.limit,
          offset: input.offset,
        }),
      ),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ ctx, input }) => deps.getEmail.execute({ userId: ctx.user.id, id: input.id })),

    getThread: protectedProcedure
      .input(z.object({ threadId: z.string() }))
      .query(({ ctx, input }) => deps.getThread.execute({ userId: ctx.user.id, threadId: input.threadId })),

    star: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => unwrap(await deps.toggleStar.execute({ actorId: ctx.user.id, id: input.id }))),

    markRead: protectedProcedure
      .input(z.object({ ids: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.setReadState.execute({ actorId: ctx.user.id, ids: input.ids, read: true })),
      ),

    markUnread: protectedProcedure
      .input(z.object({ ids: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.setReadState.execute({ actorId: ctx.user.id, ids: input.ids, read: false })),
      ),

    archive: protectedProcedure
      .input(z.object({ ids: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.moveEmails.execute({ actorId: ctx.user.id, ids: input.ids, folder: 'archive' })),
      ),

    delete: protectedProcedure
      .input(z.object({ ids: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.moveEmails.execute({ actorId: ctx.user.id, ids: input.ids, folder: 'trash' })),
      ),

    snooze: protectedProcedure
      .input(z.object({ id: z.string(), until: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.snoozeEmail.execute({ actorId: ctx.user.id, id: input.id, until: input.until })),
      ),

    labelToggle: protectedProcedure
      .input(z.object({ id: z.string(), labelName: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.toggleLabel.execute({ actorId: ctx.user.id, id: input.id, labelName: input.labelName })),
      ),

    moveToSpam: protectedProcedure
      .input(z.object({ ids: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.moveEmails.execute({ actorId: ctx.user.id, ids: input.ids, folder: 'spam' })),
      ),

    folderCounts: protectedProcedure
      .input(z.object({ accountId: z.string().optional() }).optional().default({}))
      .query(({ ctx, input }) => deps.folderCounts.execute({ userId: ctx.user.id, accountId: input.accountId })),

    labels: router({
      list: protectedProcedure
        .input(z.object({ accountId: z.string() }))
        .query(({ ctx, input }) => deps.listLabels.execute({ userId: ctx.user.id, accountId: input.accountId })),

      create: protectedProcedure
        .input(z.object({ accountId: z.string(), name: z.string(), color: z.string().default('#6b7280') }))
        .mutation(async ({ ctx, input }) => unwrap(await deps.createLabel.execute({ actorId: ctx.user.id, ...input }))),

      delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) =>
          unwrap(await deps.deleteLabel.execute({ actorId: ctx.user.id, id: input.id })),
        ),
    }),

    aiEnabled: protectedProcedure.query(async () => unwrap(await deps.checkAiEnabled.execute())),

    aiSummary: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.generateAiSummary.execute({ actorId: ctx.user.id, id: input.id })),
      ),

    aiDraft: protectedProcedure
      .input(z.object({ id: z.string(), prompt: z.string().optional() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.generateAiDraft.execute({ actorId: ctx.user.id, id: input.id, prompt: input.prompt })),
      ),
  })
