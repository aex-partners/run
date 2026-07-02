// Wiring for the `conversations` context (DMs, group chats, messages). Its four
// ACL bridges resolve display names + attachment grants through identity/agents/
// files in-ports (passed in as ACL providers). Exposes the append/post/ensure/
// list in-ports that identity, reminders, tasks and the assistant bridge to.
import { Infra } from '@/main/wiring/infra'
import { AclProviders } from '@/main/wiring/aclProviders'

import { DrizzleConversationRepository } from '@/contexts/conversations/adapters/out/persistence/DrizzleConversationRepository'
import { DrizzleConversationMemberRepository } from '@/contexts/conversations/adapters/out/persistence/DrizzleConversationMemberRepository'
import { DrizzleMessageRepository } from '@/contexts/conversations/adapters/out/persistence/DrizzleMessageRepository'
import { DrizzleGetConversation } from '@/contexts/conversations/adapters/out/persistence/DrizzleGetConversation'
import { DrizzleListConversations } from '@/contexts/conversations/adapters/out/persistence/DrizzleListConversations'
import { DrizzleListMessages } from '@/contexts/conversations/adapters/out/persistence/DrizzleListMessages'
import { NameResolver } from '@/contexts/conversations/application/ports/out/NameResolver'
import { AgentDirectory as ConvAgentDirectory } from '@/contexts/conversations/application/ports/out/AgentDirectory'
import { AttachmentResolver as ConvAttachmentResolver } from '@/contexts/conversations/application/ports/out/AttachmentResolver'
import { AuthorDirectory as ConvAuthorDirectory } from '@/contexts/conversations/application/ports/out/AuthorDirectory'
import { AppendMessageService } from '@/contexts/conversations/application/use-cases/AppendMessageService'
import { PostSystemMessageService } from '@/contexts/conversations/application/use-cases/PostSystemMessageService'
import { EnsureDmService } from '@/contexts/conversations/application/use-cases/EnsureDmService'
import { EnsureEricService } from '@/contexts/conversations/application/use-cases/EnsureEricService'
import { CreateConversationService } from '@/contexts/conversations/application/use-cases/CreateConversationService'
import { AddMemberService } from '@/contexts/conversations/application/use-cases/AddMemberService'
import { DeleteConversationService } from '@/contexts/conversations/application/use-cases/DeleteConversationService'
import { RenameConversationService } from '@/contexts/conversations/application/use-cases/RenameConversationService'
import { SetConversationAgentService } from '@/contexts/conversations/application/use-cases/SetConversationAgentService'
import { MarkConversationReadService } from '@/contexts/conversations/application/use-cases/MarkConversationReadService'
import { ToggleConversationFlagService } from '@/contexts/conversations/application/use-cases/ToggleConversationFlagService'
import { ForwardMessagesService } from '@/contexts/conversations/application/use-cases/ForwardMessagesService'
import { PinMessageService } from '@/contexts/conversations/application/use-cases/PinMessageService'
import { StarMessageService } from '@/contexts/conversations/application/use-cases/StarMessageService'
import { ReactToMessageService } from '@/contexts/conversations/application/use-cases/ReactToMessageService'
import { DeleteMessagesForEveryoneService } from '@/contexts/conversations/application/use-cases/DeleteMessagesForEveryoneService'
import { DeleteMessagesForMeService } from '@/contexts/conversations/application/use-cases/DeleteMessagesForMeService'
import { EditTranscriptionService } from '@/contexts/conversations/application/use-cases/EditTranscriptionService'
import { MarkQuickReplyAnsweredService } from '@/contexts/conversations/application/use-cases/MarkQuickReplyAnsweredService'
import { conversationController } from '@/contexts/conversations/adapters/in/http/ConversationController'
import { messageController } from '@/contexts/conversations/adapters/in/http/MessageController'

type ConversationsDeps = Pick<AclProviders, 'getUsers' | 'lookupAgents' | 'grantFileAccess'>

export function wireConversations(infra: Infra, deps: ConversationsDeps) {
  const { db, events, clock } = infra
  const { getUsers, lookupAgents, grantFileAccess } = deps

  const convRepo = new DrizzleConversationRepository(db)
  const convMemberRepo = new DrizzleConversationMemberRepository(db)
  const messageRepo = new DrizzleMessageRepository(db)
  const getConversation = new DrizzleGetConversation(db)
  // ACL bridge: conversations NameResolver -> identity.GetUsers + agents.LookupAgents.
  // The list read-models batch-resolve display names instead of joining users/agents.
  const convNames: NameResolver = {
    userNames: async (ids) => {
      const us = await getUsers.execute(ids)
      return new Map(us.map((u) => [u.id, u.name.trim() || u.email.split('@')[0] || u.email]))
    },
    agentNames: async (ids) => {
      const ag = await lookupAgents.byIds(ids)
      return new Map(ag.map((a) => [a.id, a.name]))
    },
  }
  const listConversations = new DrizzleListConversations(db, convNames)
  const listMessages = new DrizzleListMessages(db, convNames)
  // ACL bridge: conversations AgentDirectory -> agents.LookupAgents. EnsureEric
  // needs the id of the system "eric" agent to bind the AI conversation.
  const convAgentDirectory: ConvAgentDirectory = {
    ericAgentId: async () => (await lookupAgents.bySlug('eric'))?.id ?? null,
  }
  // ACL bridge: conversations AttachmentResolver -> files.GrantFileAccess. Grants
  // the other chat members read access to a message's attachments.
  const attachmentResolver: ConvAttachmentResolver = {
    grant: (fileIds, userIds) => grantFileAccess.execute({ fileIds, userIds }),
  }
  // ACL bridge: conversations AuthorDirectory -> identity.GetUsers + agents.LookupAgents.
  // Forwarding stamps each copy with the original author's display name.
  const authorDirectory: ConvAuthorDirectory = {
    displayName: async (authorId, agentId) => {
      if (authorId) return (await getUsers.execute([authorId]))[0]?.name ?? null
      if (agentId) return (await lookupAgents.byIds([agentId]))[0]?.name ?? null
      return null
    },
  }
  const appendMessage = new AppendMessageService(messageRepo, convMemberRepo, attachmentResolver, events, clock)
  const postSystemMessage = new PostSystemMessageService(appendMessage)
  const ensureDm = new EnsureDmService(convRepo, convMemberRepo, events, clock)
  const ensureEric = new EnsureEricService(convRepo, convMemberRepo, convAgentDirectory, events, clock)
  const createConversation = new CreateConversationService(convRepo, convMemberRepo, events, clock)
  const addConvMember = new AddMemberService(convMemberRepo, clock)
  const deleteConversation = new DeleteConversationService(convRepo, convMemberRepo)
  const renameConversation = new RenameConversationService(convRepo, convMemberRepo, clock)
  const setConversationAgent = new SetConversationAgentService(convRepo, convMemberRepo, clock)
  const markConversationRead = new MarkConversationReadService(convMemberRepo, clock)
  const toggleConversationFlag = new ToggleConversationFlagService(convMemberRepo)
  const forwardMessages = new ForwardMessagesService(messageRepo, convMemberRepo, authorDirectory, events, clock)
  const pinMessage = new PinMessageService(messageRepo, convMemberRepo, events, clock)
  const starMessage = new StarMessageService(messageRepo, convMemberRepo, events, clock)
  const reactToMessage = new ReactToMessageService(messageRepo, convMemberRepo, events, clock)
  const deleteMessagesForEveryone = new DeleteMessagesForEveryoneService(messageRepo, convMemberRepo, events, clock)
  const deleteMessagesForMe = new DeleteMessagesForMeService(messageRepo, convMemberRepo)
  const editTranscription = new EditTranscriptionService(messageRepo)
  const markQuickReplyAnswered = new MarkQuickReplyAnsweredService(messageRepo)
  const conversationsCtl = conversationController({
    listConversations, getConversation, create: createConversation, ensureDm, ensureEric,
    addMember: addConvMember, rename: renameConversation, markRead: markConversationRead,
    toggleFlag: toggleConversationFlag, deleteConversation, setAgent: setConversationAgent,
  })
  const messagesCtl = messageController({
    listMessages, append: appendMessage, forward: forwardMessages, pin: pinMessage, star: starMessage,
    react: reactToMessage, deleteForEveryone: deleteMessagesForEveryone, deleteForMe: deleteMessagesForMe,
    editTranscription, markQuickReplyAnswered,
  })

  return {
    controllers: { conversations: conversationsCtl, messages: messagesCtl },
    ports: { appendMessage, postSystemMessage, ensureDm, ensureEric, listMessages },
  }
}

export type ConversationsWiring = ReturnType<typeof wireConversations>
