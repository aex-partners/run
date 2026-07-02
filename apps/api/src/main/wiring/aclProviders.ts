// Cross-context ACL providers, built up-front. Each is a thin provider OWNED by
// exactly one context that reads/writes only its owner's tables. They are pulled
// out of any single context builder because several ACL bridges are wired in a
// context section that runs BEFORE the provider's own context (e.g. conversations
// bridges to agents/files/identity). Building these first lets a bridge resolve
// through them regardless of build order.
import { Infra } from '@/main/wiring/infra'

import { DrizzleGetUsers } from '@/contexts/identity/adapters/out/persistence/DrizzleGetUsers'
import { DrizzleFindUserByEmail } from '@/contexts/identity/adapters/out/persistence/DrizzleFindUserByEmail'
import { DrizzleProvisionBotUser } from '@/contexts/identity/adapters/out/persistence/DrizzleProvisionBotUser'
import { DrizzleLookupAgents } from '@/contexts/agents/adapters/out/persistence/DrizzleLookupAgents'
import { DrizzleGetConversationAgent } from '@/contexts/conversations/adapters/out/persistence/DrizzleGetConversationAgent'
import { DrizzleManageSession } from '@/contexts/conversations/adapters/out/persistence/DrizzleManageSession'
import { DrizzleFileShareRepository } from '@/contexts/files/adapters/out/persistence/DrizzleFileShareRepository'
import { GrantFileAccessService } from '@/contexts/files/application/use-cases/GrantFileAccessService'
import { DrizzleSettingsRepository } from '@/contexts/settings/adapters/out/persistence/DrizzleSettingsRepository'
import { GetSettingService } from '@/contexts/settings/application/use-cases/GetSettingService'

export function buildAclProviders(infra: Infra) {
  const { db, events, clock } = infra
  const getUsers = new DrizzleGetUsers(db)                          // identity
  const findUserByEmail = new DrizzleFindUserByEmail(db)            // identity
  const provisionBotUser = new DrizzleProvisionBotUser(db)          // identity
  const lookupAgents = new DrizzleLookupAgents(db)                  // agents
  const getConversationAgent = new DrizzleGetConversationAgent(db)  // conversations
  const manageSession = new DrizzleManageSession(db)               // conversations
  const fileShareRepo = new DrizzleFileShareRepository(db)          // files
  const grantFileAccess = new GrantFileAccessService(fileShareRepo, events, clock) // files
  const settingsRepo = new DrizzleSettingsRepository(db)            // settings
  const getSetting = new GetSettingService(settingsRepo)           // settings
  return {
    getUsers,
    findUserByEmail,
    provisionBotUser,
    lookupAgents,
    getConversationAgent,
    manageSession,
    fileShareRepo,
    grantFileAccess,
    settingsRepo,
    getSetting,
  }
}

export type AclProviders = ReturnType<typeof buildAclProviders>
