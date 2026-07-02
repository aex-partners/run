// Wiring for the `email` context (IMAP/SMTP accounts, threads, AI assist). Three
// ACL bridges: SettingsReader -> settings.GetSetting, AttachmentStore -> files
// FileStorage, and AiDrafter -> assistant RunInference (read through the late-bound
// `ai` holder, since RunInference is built after this module). Exposes the
// transactional sender (identity invites + notification digests bridge to it),
// the queue/snooze worker consumers and createAccount (settings setup wizard).
import { Infra } from '@/main/wiring/infra'
import { AclProviders } from '@/main/wiring/aclProviders'

import { DrizzleEmailAccountRepository } from '@/contexts/email/adapters/out/persistence/DrizzleEmailAccountRepository'
import { DrizzleEmailLabelRepository } from '@/contexts/email/adapters/out/persistence/DrizzleEmailLabelRepository'
import { DrizzleEmailRepository } from '@/contexts/email/adapters/out/persistence/DrizzleEmailRepository'
import { DrizzleMailMemberRepository } from '@/contexts/email/adapters/out/persistence/DrizzleMailMemberRepository'
import { DrizzleMailSettings } from '@/contexts/email/adapters/out/persistence/DrizzleMailSettings'
import { DrizzleFolderCounts } from '@/contexts/email/adapters/out/persistence/DrizzleFolderCounts'
import { DrizzleGetEmail } from '@/contexts/email/adapters/out/persistence/DrizzleGetEmail'
import { DrizzleGetSmtpDefaults } from '@/contexts/email/adapters/out/persistence/DrizzleGetSmtpDefaults'
import { DrizzleGetThread } from '@/contexts/email/adapters/out/persistence/DrizzleGetThread'
import { DrizzleIsConfigured } from '@/contexts/email/adapters/out/persistence/DrizzleIsConfigured'
import { DrizzleListAccounts } from '@/contexts/email/adapters/out/persistence/DrizzleListAccounts'
import { DrizzleListEmails } from '@/contexts/email/adapters/out/persistence/DrizzleListEmails'
import { DrizzleListLabels } from '@/contexts/email/adapters/out/persistence/DrizzleListLabels'
import { AesCipher } from '@/contexts/email/adapters/out/crypto/AesCipher'
import { NodemailerSender } from '@/contexts/email/adapters/out/smtp/NodemailerSender'
import { ImapflowClient } from '@/contexts/email/adapters/out/imap/ImapflowClient'
import { BullMqEmailQueue } from '@/contexts/email/adapters/out/queue/BullMqEmailQueue'
import { BullMqSnoozeScheduler } from '@/contexts/email/adapters/out/queue/BullMqSnoozeScheduler'
import { TemplateRenderer } from '@/contexts/email/adapters/out/templates/TemplateRenderer'
import { NetworkAutodiscovery } from '@/contexts/email/adapters/out/autodiscover/NetworkAutodiscovery'
import { AddMemberService as EmailAddMemberService } from '@/contexts/email/application/use-cases/AddMemberService'
import { AutodiscoverService } from '@/contexts/email/application/use-cases/AutodiscoverService'
import { CheckAiEnabledService } from '@/contexts/email/application/use-cases/CheckAiEnabledService'
import { CreateAccountService } from '@/contexts/email/application/use-cases/CreateAccountService'
import { CreateLabelService } from '@/contexts/email/application/use-cases/CreateLabelService'
import { DeleteAccountService } from '@/contexts/email/application/use-cases/DeleteAccountService'
import { DeleteLabelService } from '@/contexts/email/application/use-cases/DeleteLabelService'
import { DeliverQueuedEmailService } from '@/contexts/email/application/use-cases/DeliverQueuedEmailService'
import { GenerateAiDraftService } from '@/contexts/email/application/use-cases/GenerateAiDraftService'
import { GenerateAiSummaryService } from '@/contexts/email/application/use-cases/GenerateAiSummaryService'
import { MoveEmailsService } from '@/contexts/email/application/use-cases/MoveEmailsService'
import { RemoveMemberService } from '@/contexts/email/application/use-cases/RemoveMemberService'
import { SendEmailService } from '@/contexts/email/application/use-cases/SendEmailService'
import { SendTransactionalEmailService } from '@/contexts/email/application/use-cases/SendTransactionalEmailService'
import { SetReadStateService } from '@/contexts/email/application/use-cases/SetReadStateService'
import { SnoozeEmailService } from '@/contexts/email/application/use-cases/SnoozeEmailService'
import { SyncAccountService } from '@/contexts/email/application/use-cases/SyncAccountService'
import { ToggleLabelService } from '@/contexts/email/application/use-cases/ToggleLabelService'
import { ToggleStarService } from '@/contexts/email/application/use-cases/ToggleStarService'
import { UpdateAccountService } from '@/contexts/email/application/use-cases/UpdateAccountService'
import { VerifyImapService } from '@/contexts/email/application/use-cases/VerifyImapService'
import { VerifySmtpService } from '@/contexts/email/application/use-cases/VerifySmtpService'
import { WakeSnoozedEmailService } from '@/contexts/email/application/use-cases/WakeSnoozedEmailService'
import { emailController } from '@/contexts/email/adapters/in/http/EmailController'
import { AiDrafter } from '@/contexts/email/application/ports/out/AiDrafter'
import { AttachmentStore } from '@/contexts/email/application/ports/out/AttachmentStore'
import { SettingsReader } from '@/contexts/email/application/ports/out/SettingsReader'
import { RunInference } from '@/contexts/assistant/application/ports/in/RunInference'

type EmailDeps = Pick<AclProviders, 'getSetting'> & {
  fileStorage: { read: (path: string) => Promise<Uint8Array> }
  ai: { run: RunInference | undefined }
}

export function wireEmail(infra: Infra, deps: EmailDeps) {
  const { db, env, events, clock, bullConnection } = infra
  const { getSetting, fileStorage, ai } = deps

  const emailAccountRepo = new DrizzleEmailAccountRepository(db)
  const emailLabelRepo = new DrizzleEmailLabelRepository(db)
  const emailRepo = new DrizzleEmailRepository(db)
  const mailMemberRepo = new DrizzleMailMemberRepository(db)
  // ACL bridge: email SettingsReader -> settings.GetSetting (one setting value by
  // key, stringified). The email context owns no settings table.
  const settingsReader: SettingsReader = {
    get: async (key) => {
      const r = await getSetting.execute({ key })
      return r == null ? null : String(r)
    },
  }
  const mailSettings = new DrizzleMailSettings(settingsReader)
  const folderCounts = new DrizzleFolderCounts(db)
  const getEmail = new DrizzleGetEmail(db)
  const getSmtpDefaults = new DrizzleGetSmtpDefaults(settingsReader)
  const getThread = new DrizzleGetThread(db)
  const isConfigured = new DrizzleIsConfigured(db)
  const listEmailAccounts = new DrizzleListAccounts(db)
  const listEmails = new DrizzleListEmails(db)
  const listLabels = new DrizzleListLabels(db)
  const emailCipher = new AesCipher(env.EMAIL_ENCRYPTION_KEY)
  const smtpSender = new NodemailerSender()
  const imapClient = new ImapflowClient()
  const emailQueue = new BullMqEmailQueue(bullConnection)
  const snoozeScheduler = new BullMqSnoozeScheduler(bullConnection)
  const templateRenderer = new TemplateRenderer()
  const autodiscovery = new NetworkAutodiscovery()
  // ACL bridge: email AttachmentStore -> files FileStorage.read.
  const attachmentStore: AttachmentStore = { read: (path) => fileStorage.read(path) }
  // ACL bridge: email AiDrafter -> assistant RunInference (non-streaming batch).
  const aiDrafter: AiDrafter = {
    isEnabled: async () => !!ai.run && !!env.ANTHROPIC_API_KEY,
    summarize: async (body) => {
      if (!ai.run) return ''
      const r = await ai.run.execute({
        systemPrompt: 'Summarize this email in one or two sentences.',
        prompt: body,
        allowedTools: [],
      })
      return r.ok ? r.value.text : ''
    },
    draft: async (input) => {
      if (!ai.run) return ''
      const r = await ai.run.execute({
        systemPrompt: 'Write a concise, professional reply draft to this email.',
        prompt: `Subject: ${input.subject}\nFrom: ${input.from}\n\n${input.body}${input.prompt ? `\n\nInstructions: ${input.prompt}` : ''}`,
        allowedTools: [],
      })
      return r.ok ? r.value.text : ''
    },
  }
  const syncAccount = new SyncAccountService(emailAccountRepo, emailRepo, imapClient, emailCipher, clock)
  const createAccount = new CreateAccountService(emailAccountRepo, mailMemberRepo, emailCipher, syncAccount, events, clock)
  const updateAccount = new UpdateAccountService(emailAccountRepo, emailCipher, events, clock)
  const deleteAccount = new DeleteAccountService(emailAccountRepo, events, clock)
  const addMailMember = new EmailAddMemberService(emailAccountRepo, mailMemberRepo, events, clock)
  const removeMailMember = new RemoveMemberService(emailAccountRepo, mailMemberRepo, events, clock)
  const verifySmtp = new VerifySmtpService(smtpSender)
  const verifyImap = new VerifyImapService(imapClient)
  const autodiscover = new AutodiscoverService(autodiscovery, clock)
  const sendEmail = new SendEmailService(emailAccountRepo, mailMemberRepo, emailRepo, smtpSender, emailCipher, attachmentStore, events, clock)
  const moveEmails = new MoveEmailsService(emailAccountRepo, emailRepo, events, clock)
  const setReadState = new SetReadStateService(emailAccountRepo, emailRepo, events, clock)
  const toggleStar = new ToggleStarService(emailAccountRepo, emailRepo, events, clock)
  const snoozeEmail = new SnoozeEmailService(emailAccountRepo, emailRepo, snoozeScheduler, events, clock)
  const wakeSnoozedEmail = new WakeSnoozedEmailService(emailRepo, events, clock)
  const toggleLabel = new ToggleLabelService(emailAccountRepo, emailRepo, emailLabelRepo, events, clock)
  const createLabel = new CreateLabelService(emailAccountRepo, emailLabelRepo, events, clock)
  const deleteLabel = new DeleteLabelService(emailAccountRepo, emailLabelRepo, events, clock)
  const checkAiEnabled = new CheckAiEnabledService(aiDrafter)
  const generateAiSummary = new GenerateAiSummaryService(emailAccountRepo, emailRepo, aiDrafter, events, clock)
  const generateAiDraft = new GenerateAiDraftService(emailAccountRepo, emailRepo, aiDrafter, events, clock)
  const sendTransactionalEmail = new SendTransactionalEmailService(mailSettings, templateRenderer, emailQueue)
  const deliverQueuedEmail = new DeliverQueuedEmailService(emailAccountRepo, emailRepo, smtpSender, emailCipher, events, clock)
  const emailsCtl = emailController({
    isConfigured, listAccounts: listEmailAccounts, getSmtpDefaults, autodiscover, createAccount,
    updateAccount, deleteAccount, addMember: addMailMember, removeMember: removeMailMember,
    verifySmtp, verifyImap, syncAccount, sendEmail, listEmails, getEmail, getThread, toggleStar,
    setReadState, moveEmails, snoozeEmail, toggleLabel, folderCounts, listLabels, createLabel,
    deleteLabel, checkAiEnabled, generateAiSummary, generateAiDraft,
  })

  return {
    controller: emailsCtl,
    ports: { sendTransactionalEmail, deliverQueuedEmail, wakeSnoozedEmail, createAccount },
  }
}

export type EmailWiring = ReturnType<typeof wireEmail>
