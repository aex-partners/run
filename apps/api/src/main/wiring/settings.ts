// Wiring for the `settings` context (key/value settings + setup wizard). The
// settingsRepo + GetSetting in-port live in wiring/aclProviders (email bridges its
// SettingsReader to GetSetting). Two ACL bridges: AuditTrail -> audit.RecordAuditEvent
// and a cross-context SAGA SetupProvisioner that fans the wizard's effects out to
// identity (invites), agents (seed Eric) and email (SMTP account), promoting the
// actor to owner directly in the shared users table (best-effort).
import { eq } from 'drizzle-orm'
import * as schema from '@/platform/db/schema'
import { Infra } from '@/main/wiring/infra'
import { AclProviders } from '@/main/wiring/aclProviders'
import { AuditWiring } from '@/main/wiring/audit'
import { IdentityWiring } from '@/main/wiring/identity'
import { AgentsWiring } from '@/main/wiring/agents'
import { EmailWiring } from '@/main/wiring/email'

import { CheckSetupCompleteService } from '@/contexts/settings/application/use-cases/CheckSetupCompleteService'
import { SetSettingService } from '@/contexts/settings/application/use-cases/SetSettingService'
import { CompleteSetupService } from '@/contexts/settings/application/use-cases/CompleteSetupService'
import { settingsController } from '@/contexts/settings/adapters/in/http/SettingsController'
import { AuditTrail as SettingsAuditTrail } from '@/contexts/settings/application/ports/out/AuditTrail'
import { SetupProvisioner } from '@/contexts/settings/application/ports/out/SetupProvisioner'
import { assembleSystemPrompt } from '@/contexts/assistant/domain/SystemPrompt'
import { DEFAULT_AGENT_NAME } from '@/contexts/assistant/domain/AgentConfig'

type SettingsDeps = Pick<AclProviders, 'settingsRepo' | 'getSetting'> & {
  recordAuditEvent: AuditWiring['ports']['recordAuditEvent']
  inviteUser: IdentityWiring['ports']['inviteUser']
  createAgent: AgentsWiring['ports']['createAgent']
  createAccount: EmailWiring['ports']['createAccount']
}

export function wireSettings(infra: Infra, deps: SettingsDeps) {
  const { db, clock } = infra
  const { settingsRepo, getSetting, recordAuditEvent, inviteUser, createAgent, createAccount } = deps

  // ACL bridge: settings AuditTrail -> audit RecordAuditEvent.
  const settingsAuditTrail: SettingsAuditTrail = {
    record: async (e) => { await recordAuditEvent.execute(e) },
  }
  // ACL bridge (SAGA): settings SetupProvisioner fans out across contexts. Best-
  // effort: promote the actor to owner + process invites. Routine entities (data)
  // and the SMTP account (email) are left as TODO.
  // SAGA: settings SetupProvisioner fans out the wizard's cross-context effects
  // to each context's in-port (best-effort; the setting writes already committed).
  const setupProvisioner: SetupProvisioner = {
    provision: async (request) => {
      // 1) promote the setup user to owner
      try {
        await db.update(schema.users).set({ role: 'owner' }).where(eq(schema.users.id, request.actorUserId))
      } catch {
        /* best-effort */
      }
      // 2) process invites (identity)
      for (const email of request.invites ?? []) {
        try {
          await inviteUser.execute({ actorId: request.actorUserId, name: email, email })
        } catch {
          /* best-effort per invite */
        }
      }
      // 3) seed the default Eric agent (agents) — its backing bot user is
      // provisioned via the BotUserProvisioner bridge; slug-collision = already seeded.
      try {
        await createAgent.execute({
          actorId: request.actorUserId,
          name: DEFAULT_AGENT_NAME,
          systemPrompt: assembleSystemPrompt({ agentName: DEFAULT_AGENT_NAME }),
        })
      } catch {
        /* best-effort: already exists */
      }
      // 4) provision the SMTP mail account (email) when the wizard supplied one
      if (request.emailProvider === 'smtp' && request.smtpHost && request.smtpUser && request.smtpPass) {
        try {
          await createAccount.execute({
            ownerId: request.actorUserId,
            displayName: request.orgName ?? 'Mail',
            emailAddress: request.smtpFrom ?? request.smtpUser,
            fromName: request.orgName,
            smtpHost: request.smtpHost,
            smtpPort: Number(request.smtpPort) || 587,
            smtpUser: request.smtpUser,
            smtpPass: request.smtpPass,
            smtpSecure: request.smtpSecure ?? true,
            imapPort: 993,
            imapSecure: true,
            isShared: true,
          })
        } catch {
          /* best-effort */
        }
      }
      // 5) TODO: seed routine entities (data) — the AEX starter-entity set is
      // seed data with a source-specific definition list; left for a seed script.
    },
  }
  const checkSetupComplete = new CheckSetupCompleteService(settingsRepo)
  const setSetting = new SetSettingService(settingsRepo, settingsAuditTrail, clock)
  const completeSetup = new CompleteSetupService(settingsRepo, setupProvisioner, clock)
  const settingsCtl = settingsController({ checkSetupComplete, getSetting, setSetting, completeSetup })

  return { controller: settingsCtl }
}

export type SettingsWiring = ReturnType<typeof wireSettings>
