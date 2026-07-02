// Wiring for the `identity` context (users, sessions, invites, profile). Three ACL
// bridges: AuditTrail -> audit.RecordAuditEvent, ConversationGateway ->
// conversations.EnsureDm/EnsureEric, InviteNotifier -> email.SendTransactionalEmail.
// Exposes getSession (notification digests resolve recipient email through it) and
// inviteUser (the settings setup wizard processes invites through it).
import { JsonObject } from '@/shared/domain/Json'
import { Infra } from '@/main/wiring/infra'
import { AuditWiring } from '@/main/wiring/audit'
import { ConversationsWiring } from '@/main/wiring/conversations'
import { EmailWiring } from '@/main/wiring/email'

import { DrizzleUserRepository } from '@/contexts/identity/adapters/out/persistence/DrizzleUserRepository'
import { DrizzleLoginAttemptStore } from '@/contexts/identity/adapters/out/persistence/DrizzleLoginAttemptStore'
import { DrizzleVerificationStore } from '@/contexts/identity/adapters/out/persistence/DrizzleVerificationStore'
import { DrizzleListUsers } from '@/contexts/identity/adapters/out/persistence/DrizzleListUsers'
import { DrizzleListAssignableUsers } from '@/contexts/identity/adapters/out/persistence/DrizzleListAssignableUsers'
import { HibpBreachChecker } from '@/contexts/identity/adapters/out/security/HibpBreachChecker'
import { ScryptPasswordHasher } from '@/contexts/identity/adapters/out/security/ScryptPasswordHasher'
import { BetterAuthSessionGateway } from '@/contexts/identity/adapters/out/session/BetterAuthSessionGateway'
import { InviteUserService } from '@/contexts/identity/application/use-cases/InviteUserService'
import { GetSessionService } from '@/contexts/identity/application/use-cases/GetSessionService'
import { ChangeUserRoleService } from '@/contexts/identity/application/use-cases/ChangeUserRoleService'
import { DeleteUserService } from '@/contexts/identity/application/use-cases/DeleteUserService'
import { RenameUserService } from '@/contexts/identity/application/use-cases/RenameUserService'
import { SetUserStatusService } from '@/contexts/identity/application/use-cases/SetUserStatusService'
import { UnlockAccountService } from '@/contexts/identity/application/use-cases/UnlockAccountService'
import { UpdateProfileService } from '@/contexts/identity/application/use-cases/UpdateProfileService'
import { authController } from '@/contexts/identity/adapters/in/http/AuthController'
import { profileController } from '@/contexts/identity/adapters/in/http/ProfileController'
import { usersController } from '@/contexts/identity/adapters/in/http/UsersController'
import { AuditTrail as IdentityAuditTrail } from '@/contexts/identity/application/ports/out/AuditTrail'
import { ConversationGateway as IdentityConversationGateway } from '@/contexts/identity/application/ports/out/ConversationGateway'
import { InviteNotifier } from '@/contexts/identity/application/ports/out/InviteNotifier'

type IdentityDeps = {
  recordAuditEvent: AuditWiring['ports']['recordAuditEvent']
  conversations: Pick<ConversationsWiring['ports'], 'ensureDm' | 'ensureEric'>
  sendTransactionalEmail: EmailWiring['ports']['sendTransactionalEmail']
}

export function wireIdentity(infra: Infra, deps: IdentityDeps) {
  const { db, env, events, clock, auth } = infra
  const { recordAuditEvent, conversations, sendTransactionalEmail } = deps
  const { ensureDm, ensureEric } = conversations

  const userRepo = new DrizzleUserRepository(db)
  const loginAttemptStore = new DrizzleLoginAttemptStore(db)
  const verificationStore = new DrizzleVerificationStore(db)
  const listUsers = new DrizzleListUsers(db)
  const listAssignableUsers = new DrizzleListAssignableUsers(db)
  void new HibpBreachChecker()
  void new ScryptPasswordHasher()
  void new BetterAuthSessionGateway(auth)
  // ACL bridge: identity AuditTrail -> audit RecordAuditEvent.
  const identityAuditTrail: IdentityAuditTrail = {
    record: async (e) => {
      await recordAuditEvent.execute({ ...e, metadata: (e.metadata ?? null) as JsonObject | null })
    },
  }
  // ACL bridge: identity ConversationGateway -> conversations EnsureDm/EnsureEric.
  const identityConversationGateway: IdentityConversationGateway = {
    ensureDm: async (inviterId, inviteeId) => { await ensureDm.execute({ userId: inviterId, peerUserId: inviteeId }) },
    ensureEric: async (userId) => { await ensureEric.execute({ userId }) },
  }
  // ACL bridge: identity InviteNotifier -> email SendTransactionalEmail (invite template).
  const inviteNotifier: InviteNotifier = {
    sendInvite: async (input) => {
      const setupUrl = `${env.CORS_ORIGIN}/setup?token=${encodeURIComponent(input.token)}`
      const r = await sendTransactionalEmail.execute({
        to: input.to, template: 'invite', data: { name: input.name, inviterName: input.inviterName, setupUrl },
      })
      return { sent: r.ok && r.value.sent }
    },
  }
  const getSession = new GetSessionService(userRepo)
  const inviteUser = new InviteUserService(userRepo, verificationStore, identityConversationGateway, inviteNotifier, identityAuditTrail, events, clock)
  const changeUserRole = new ChangeUserRoleService(userRepo, identityAuditTrail, events, clock)
  const deleteUser = new DeleteUserService(userRepo, identityAuditTrail, events, clock)
  const renameUser = new RenameUserService(userRepo, identityAuditTrail, events, clock)
  const setUserStatus = new SetUserStatusService(userRepo, identityAuditTrail, events, clock)
  const unlockAccount = new UnlockAccountService(loginAttemptStore, userRepo, identityAuditTrail)
  const updateProfile = new UpdateProfileService(userRepo, events, clock)
  const authCtl = authController({ getSession })
  const profileCtl = profileController({ updateProfile })
  const usersCtl = usersController({
    listAssignable: listAssignableUsers, list: listUsers, invite: inviteUser, changeRole: changeUserRole,
    setStatus: setUserStatus, rename: renameUser, unlock: unlockAccount, remove: deleteUser,
  })

  return {
    controllers: { auth: authCtl, profile: profileCtl, users: usersCtl },
    ports: { getSession, inviteUser },
  }
}

export type IdentityWiring = ReturnType<typeof wireIdentity>
