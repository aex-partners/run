// REAL composition root. The ONLY place (besides demo/) allowed to import across
// contexts. It builds infra + the cross-context ACL providers, then calls one
// per-context wiring builder (src/main/wiring/) in dependency order, fulfilling
// every cross-context ACL out-port by bridging it to the target context's in-port
// — so no context imports another (enforced by dependency-cruiser). See
// docs/architecture/wiring-ledger.md.
import { Redis } from 'ioredis'

import { Database } from '@/platform/db/client'
import { Env } from '@/platform/config/env'
import { Auth } from '@/platform/auth/better-auth'
import { RunInference } from '@/contexts/assistant/application/ports/in/RunInference'

// ----- wiring builders (per-context composition; see src/main/wiring/)
import { buildInfra } from '@/main/wiring/infra'
import { buildAclProviders } from '@/main/wiring/aclProviders'
import { wireData } from '@/main/wiring/data'
import { wireKnowledge } from '@/main/wiring/knowledge'
import { wireAudit } from '@/main/wiring/audit'
import { wireAgents } from '@/main/wiring/agents'
import { wireSkills } from '@/main/wiring/skills'
import { wireGeocode } from '@/main/wiring/geocode'
import { wirePluginsCredentials } from '@/main/wiring/pluginsCredentials'
import { wireConversations } from '@/main/wiring/conversations'
import { wireFiles } from '@/main/wiring/files'
import { wireEmail } from '@/main/wiring/email'
import { wireIdentity } from '@/main/wiring/identity'
import { wireNotifications } from '@/main/wiring/notifications'
import { wireReminders } from '@/main/wiring/reminders'
import { wireTasks } from '@/main/wiring/tasks'
import { wireAutomation } from '@/main/wiring/automation'
import { wireSettings } from '@/main/wiring/settings'
import { wireAssistant } from '@/main/wiring/assistant'
import { wireForms } from '@/main/wiring/forms'
import { wirePayments } from '@/main/wiring/payments'
import { wireFiscal } from '@/main/wiring/fiscal'
import { wireBling } from '@/main/wiring/bling'
import { wireCosting } from '@/main/wiring/costing'

export function buildContainer(db: Database, redis: Redis, env: Env, auth: Auth) {
  // Infra primitives (clock, events, queue connection) + raw platform handles.
  const infra = buildInfra(db, redis, env, auth)
  const { events } = infra
  // Late-bound holder: the assistant RunInference service is built late (it needs
  // the ToolBox + spend store), but the email AiDrafter and tasks AgentRunner ACL
  // bridges are wired earlier. They close over this holder and read `ai.run` at call
  // time; the assistant builder fulfills it once RunInference exists.
  const ai: { run: RunInference | undefined } = { run: undefined }

  // Cross-context ACL providers (read/grant in-ports the bridges below resolve
  // through). Built up-front so a bridge wired before its provider's own context
  // can still reach it. See wiring/aclProviders.ts.
  const acl = buildAclProviders(infra)
  const {
    getUsers, findUserByEmail, lookupAgents, getConversationAgent, manageSession,
    fileShareRepo, grantFileAccess, settingsRepo, getSetting, provisionBotUser,
  } = acl

  // ----- contexts with no cross-context construction-time deps (infra-only).
  const dataWiring = wireData(infra)
  const knowledgeWiring = wireKnowledge(infra)
  const auditWiring = wireAudit(infra)
  const agentsWiring = wireAgents(infra, provisionBotUser)
  const skillsWiring = wireSkills(infra)
  const geocodeCtl = wireGeocode(infra).controller
  // credentials + plugins are a closed pair (their late-bound oauthCfgSvc holder
  // stays internal to the builder); exposes the piece invokers automation bridges to.
  const pluginsCredentials = wirePluginsCredentials(infra)

  // payments resolves the PagSeguro token AND the Sicredi credential (auth +
  // beneficiário config, folded into one bag) from the credential store via an ACL
  // bridge to the credentials ResolveCredential in-port (same provider plugins uses).
  const paymentsWiring = wirePayments(infra, {
    resolveCredential: pluginsCredentials.ports.resolveCredential,
  })

  // fiscal (NF-e / NFC-e direct to SEFAZ) resolves the WHOLE fiscal setup (A1
  // certificate + emitente fiscal config, folded into one "nfe-certificate"
  // credential bag) from the credential store via the SAME credentials
  // ResolveCredential in-port payments uses. No settings ACL needed any more.
  const fiscalWiring = wireFiscal(infra, {
    resolveCredential: pluginsCredentials.ports.resolveCredential,
  })

  // bling (read-only ERP access: produtos / pedidos / contatos) resolves the Bling
  // OAuth2 token from the credential store via the SAME credentials
  // ResolveCredential in-port payments/fiscal use (plugin name "bling").
  const blingWiring = wireBling(infra, {
    resolveCredential: pluginsCredentials.ports.resolveCredential,
    createEntity: dataWiring.ports.createEntity,
    addField: dataWiring.ports.addField,
    describeEntity: dataWiring.ports.describeEntity,
    listEntities: dataWiring.ports.listEntities,
    insertRecord: dataWiring.ports.insertRecord,
    updateRecord: dataWiring.ports.updateRecord,
    getRecord: dataWiring.ports.getRecord,
  })

  // costing (ficha técnica explosion + cost snapshots) has no cross-context infra
  // deps: it bridges straight to the data in-ports (the SAME ones the AI ToolBox
  // and other contexts use) via its EntityRegistry + RecordStore ACL bridges.
  const costingWiring = wireCosting(infra, { data: dataWiring.ports })

  // ----- cross-context contexts, in dependency order. Each wireX takes the sibling
  // in-ports its ACL bridges resolve through (built above); container threads them.
  const conversationsWiring = wireConversations(infra, { getUsers, lookupAgents, grantFileAccess })
  const { appendMessage, postSystemMessage, ensureDm, ensureEric, listMessages } = conversationsWiring.ports

  const filesWiring = wireFiles(infra, {
    findUserByEmail, getUsers, fileShareRepo, knowledgeIndexing: knowledgeWiring.indexing,
  })
  const { fileStorage } = filesWiring.ports

  const emailWiring = wireEmail(infra, { getSetting, fileStorage, ai })
  const { sendTransactionalEmail, createAccount } = emailWiring.ports

  const identityWiring = wireIdentity(infra, {
    recordAuditEvent: auditWiring.ports.recordAuditEvent,
    conversations: { ensureDm, ensureEric },
    sendTransactionalEmail,
  })
  const { getSession, inviteUser } = identityWiring.ports

  const notificationsWiring = wireNotifications(infra, { getUsers, getSession, sendTransactionalEmail })
  const { createNotification } = notificationsWiring.ports

  const remindersWiring = wireReminders(infra, { postSystemMessage })

  const tasksWiring = wireTasks(infra, { postSystemMessage, createNotification, ai })

  const automationWiring = wireAutomation(infra, {
    invokePieceTrigger: pluginsCredentials.ports.invokePieceTrigger,
    resolvePieceAction: pluginsCredentials.ports.resolvePieceAction,
  })

  const settingsWiring = wireSettings(infra, {
    settingsRepo, getSetting,
    recordAuditEvent: auditWiring.ports.recordAuditEvent,
    inviteUser, createAgent: agentsWiring.ports.createAgent, createAccount,
  })

  // Assistant assembles the ToolBox + RunInference and FULFILLS the `ai` holder,
  // back-filling the email + tasks bridges declared above.
  const assistantWiring = wireAssistant(infra, {
    getConversationAgent, manageSession,
    data: dataWiring.ports,
    knowledge: knowledgeWiring.ports,
    payments: paymentsWiring.ports,
    fiscal: fiscalWiring.ports,
    bling: blingWiring.ports,
    costing: costingWiring.ports,
    conversations: { appendMessage, postSystemMessage, listMessages },
    resolveAgent: agentsWiring.ports.resolveAgent,
    resolveSkill: skillsWiring.ports.resolveSkill,
    ai,
  })

  const formsWiring = wireForms(infra, {
    describeEntity: dataWiring.ports.describeEntity,
    insertRecord: dataWiring.ports.insertRecord,
  })

  return {
    events,
    mcpTools: assistantWiring.mcpTools,
    // tRPC-router controllers (mounted directly by routes.ts)
    trpcControllers: {
      conversations: conversationsWiring.controllers.conversations,
      messages: conversationsWiring.controllers.messages,
      emails: emailWiring.controller,
      files: filesWiring.controller,
      settings: settingsWiring.controller,
      auditLog: auditWiring.controller,
      geocode: geocodeCtl,
      agents: agentsWiring.controller,
      auth: identityWiring.controllers.auth,
      users: identityWiring.controllers.users,
      profile: identityWiring.controllers.profile,
    },
    // plain handler-object controllers (wrapped into tRPC by routes.ts)
    plainControllers: {
      entities: dataWiring.controllers.entities,
      records: dataWiring.controllers.records,
      views: dataWiring.controllers.views,
      tasks: tasksWiring.controller,
      flows: automationWiring.controller,
      plugins: pluginsCredentials.controllers.plugins,
      credentials: pluginsCredentials.controllers.credentials,
      forms: formsWiring.controllers.forms,
      reminders: remindersWiring.controller,
      notifications: notificationsWiring.controller,
      knowledge: knowledgeWiring.controller,
      skills: skillsWiring.controller,
      assistant: assistantWiring.controller,
      payments: paymentsWiring.controller,
      fiscal: fiscalWiring.controller,
      bling: blingWiring.controller,
      costing: costingWiring.controller,
    },
    publicControllers: {
      publicForms: formsWiring.controllers.publicForms,
    },
    // in-ports the BullMQ workers drive (workers.ts builds the Worker shells)
    workerPorts: {
      runTask: tasksWiring.ports.runTask,
      runFlow: automationWiring.ports.runFlow,
      pollTriggers: automationWiring.ports.pollTriggers,
      deliverEmail: emailWiring.ports.deliverQueuedEmail,
      wakeEmail: emailWiring.ports.wakeSnoozedEmail,
      fireReminder: remindersWiring.ports.fireReminder,
      refreshCredential: pluginsCredentials.ports.refreshCredential,
      runDigest: notificationsWiring.ports.runDigest,
      indexFile: filesWiring.ports.runFileIndexing,
      syncBlingMirror: blingWiring.ports.syncBlingMirror,
    },
    // schedulers/queues to bootstrap repeatable jobs at boot
    schedulers: {
      credScheduler: pluginsCredentials.schedulers.credScheduler,
      blingSyncScheduler: blingWiring.schedulers.blingSyncScheduler,
    },
    // raw (non-tRPC) HTTP surfaces server.ts mounts directly
    http: {
      chat: assistantWiring.http.chat,
      uploadFile: filesWiring.ports.uploadFile,
      credentialOAuthCallback: pluginsCredentials.http.credentialOAuthCallback,
      flowWebhookReceiver: automationWiring.http.flowWebhookReceiver,
    },
  }
}

export type Container = ReturnType<typeof buildContainer>
