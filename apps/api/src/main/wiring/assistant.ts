// Wiring for the `assistant` context (AI chat + the shared ToolBox). This is the
// late-bound module: it assembles the MCP ToolBox from the data + knowledge
// in-ports, then builds RunInference (needs the ToolBox + Redis spend store) and
// FULFILLS the shared `ai` holder, back-filling the email AiDrafter and tasks
// AgentRunner bridges that were declared earlier. Its three ACL bridges:
// ConversationGateway -> conversations append/post/list, AgentDirectory ->
// agents.ResolveAgent + skills.ResolveSkill (+ conversations.GetConversationAgent),
// SessionStore -> conversations.ManageSession.
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { Json } from '@/shared/domain/Json'
import { fail } from '@/shared/kernel/Result'
import { assembleMcpTools } from '@/main/mcp'
import { Infra } from '@/main/wiring/infra'
import { AclProviders } from '@/main/wiring/aclProviders'
import { DataWiring } from '@/main/wiring/data'
import { KnowledgeWiring } from '@/main/wiring/knowledge'
import { PaymentsWiring } from '@/main/wiring/payments'
import { FiscalWiring } from '@/main/wiring/fiscal'
import { BlingWiring } from '@/main/wiring/bling'
import { CostingWiring } from '@/main/wiring/costing'
import { ManufacturingWiring } from '@/main/wiring/manufacturing'
import { ConversationsWiring } from '@/main/wiring/conversations'
import { AgentsWiring } from '@/main/wiring/agents'
import { SkillsWiring } from '@/main/wiring/skills'

import { SessionStore as AssistantSessionStore } from '@/contexts/assistant/application/ports/out/SessionStore'
import { RedisSpendStore } from '@/contexts/assistant/adapters/out/spend/RedisSpendStore'
import { ClaudeAgentRuntime } from '@/contexts/assistant/adapters/out/llm/ClaudeAgentRuntime'
import { StubAgentRuntime } from '@/contexts/assistant/adapters/out/llm/StubAgentRuntime'
import { DefaultAgentDirectory } from '@/contexts/assistant/adapters/out/agent/DefaultAgentDirectory'
import { RunInference } from '@/contexts/assistant/application/ports/in/RunInference'
import { RunInferenceService } from '@/contexts/assistant/application/use-cases/RunInferenceService'
import { ClaudeBatchRuntime } from '@/contexts/assistant/adapters/out/llm/ClaudeBatchRuntime'
import { AgentDirectory as AssistantAgentDirectory } from '@/contexts/assistant/application/ports/out/AgentDirectory'
import { assembleSystemPrompt } from '@/contexts/assistant/domain/SystemPrompt'
import { DEFAULT_AGENT_NAME } from '@/contexts/assistant/domain/AgentConfig'
import { StaticSubagentRunner } from '@/contexts/assistant/adapters/out/agent/StaticSubagentRunner'
import { InMemoryConfirmationBroker } from '@/contexts/assistant/adapters/out/confirmation/InMemoryConfirmationBroker'
import { InMemoryConversationRepository } from '@/contexts/assistant/adapters/out/persistence/InMemoryConversationRepository'
import { ChatHandlerService } from '@/contexts/assistant/application/use-cases/ChatHandlerService'
import { SendMessageService } from '@/contexts/assistant/application/use-cases/SendMessageService'
import { conversationController as assistantConversationController } from '@/contexts/assistant/adapters/in/http/ConversationController'
import { ToolBox } from '@/contexts/assistant/application/ports/out/ToolBox'
import { ConversationGateway as AssistantConversationGateway } from '@/contexts/assistant/application/ports/out/ConversationGateway'

// A fixed actor used when an MCP tool (driven by the AI runtime's shared ToolBox)
// writes user-scoped data. AEX Run is single-tenant; per-request tool scoping is
// a future refinement (see report).
const SYSTEM_TOOL_USER = 'system'

type AssistantDeps = Pick<AclProviders, 'getConversationAgent' | 'manageSession'> & {
  data: Pick<DataWiring['ports'], 'createEntity' | 'insertRecord' | 'updateRecord' | 'deleteRecord' | 'describeEntity' | 'listEntities' | 'queryRecords'>
  knowledge: Pick<KnowledgeWiring['ports'], 'createKnowledge' | 'queryKnowledge' | 'deleteKnowledge'>
  payments: PaymentsWiring['ports']
  fiscal: Pick<FiscalWiring['ports'], 'emitNfe' | 'emitNfce'>
  bling: Pick<BlingWiring['ports'], 'listBlingResource' | 'getBlingRecord'>
  costing: CostingWiring['ports']
  manufacturing: Pick<
    ManufacturingWiring['ports'],
    'obterRoteiro' | 'definirCentro' | 'listarCentros' | 'definirOperacao' | 'publicarRoteiro'
    | 'abrirRevisaoRoteiro'
  >
  conversations: Pick<ConversationsWiring['ports'], 'appendMessage' | 'postSystemMessage' | 'listMessages'>
  resolveAgent: AgentsWiring['ports']['resolveAgent']
  resolveSkill: SkillsWiring['ports']['resolveSkill']
  ai: { run: RunInference | undefined }
}

export function wireAssistant(infra: Infra, deps: AssistantDeps) {
  const { redis, clock } = infra
  const { getConversationAgent, manageSession, data, knowledge, payments, fiscal, bling, costing, manufacturing, conversations, resolveAgent, resolveSkill, ai } = deps
  const { createEntity, insertRecord, updateRecord, deleteRecord, describeEntity, listEntities, queryRecords } = data
  const { createKnowledge, queryKnowledge, deleteKnowledge } = knowledge
  const { createCharge, getCharge, createPaymentLink, createBoleto } = payments
  const { emitNfe, emitNfce } = fiscal
  const { listBlingResource, getBlingRecord } = bling
  const { explodirFicha, recalcularCusto, publicarRevisao, historicoCusto, definirTaxaCusto, custoUnitario } = costing
  const { obterRoteiro, definirCentro, listarCentros, definirOperacao, publicarRoteiro, abrirRevisaoRoteiro } = manufacturing
  const { appendMessage, postSystemMessage, listMessages } = conversations

  // Assemble the AI ToolBox from every context's MCP tools (data + knowledge +
  // payments + fiscal + bling + costing + manufacturing).
  const mcpTools: ToolDefinition[] = assembleMcpTools({
    createEntity, insertRecord, updateRecord, deleteRecord, describeEntity, listEntities, queryRecords,
    createKnowledge, queryKnowledge, deleteKnowledge, knowledgeUserId: SYSTEM_TOOL_USER,
    createCharge, getCharge, createPaymentLink, createBoleto,
    emitNfe, emitNfce,
    listBlingResource, getBlingRecord,
    explodirFicha, recalcularCusto, publicarRevisao, historicoCusto, definirTaxaCusto, custoUnitario,
    obterRoteiro, definirCentro, listarCentros, definirOperacao, publicarRoteiro, abrirRevisaoRoteiro,
  })
  const toolIndex = new Map(mcpTools.map((t) => [t.name, t]))
  const toolBox: ToolBox = {
    names: () => [...toolIndex.keys()],
    descriptors: () => mcpTools.map((t) => ({ name: t.name, description: t.description, readOnly: t.readOnly })),
    execute: async (name, input) => {
      const tool = toolIndex.get(name)
      if (!tool) return fail<Json>(`unknown tool "${name}"`)
      return tool.execute(input)
    },
  }
  // ACL bridge: assistant ConversationGateway -> conversations append/post/list.
  const assistantConversationGateway: AssistantConversationGateway = {
    postUserMessage: async ({ conversationId, userId, content }) => {
      await appendMessage.execute({ conversationId, authorId: userId, content, role: 'user', requireMembership: false })
    },
    postAssistantMessage: async ({ conversationId, agentId, agentName, content }) => {
      await appendMessage.execute({ conversationId, authorId: null, agentId, authorName: agentName, content, role: 'ai', requireMembership: false })
    },
    postSystemMessage: async ({ conversationId, content }) => {
      await postSystemMessage.execute({ conversationId, content })
    },
    history: async ({ conversationId, userId, limit }) => {
      const res = await listMessages.execute({ conversationId, userId, limit: limit ?? 50 })
      return res.items.map((m) => ({ role: m.role, authorName: m.authorName, content: m.content, createdAt: m.createdAt }))
    },
  }
  // ACL bridge: assistant AgentDirectory -> agents.ResolveAgent + skills.ResolveSkill.
  // Reads the conversation's bound agentId, resolves the agent, expands its skills,
  // and assembles the system prompt. Falls back to the default agent on any miss.
  const agentDirectory: AssistantAgentDirectory = {
    resolve: async (conversationId, _userId) => {
      // ACL: read the conversation's bound agentId through conversations' in-port
      // (never the `conversations` table directly).
      const agentId = await getConversationAgent.execute(conversationId)
      const resolved = await resolveAgent.execute({ agentId, defaultName: DEFAULT_AGENT_NAME })
      const skillPrompts: string[] = []
      const toolIds = new Set(resolved.toolIds)
      for (const sid of resolved.skillIds) {
        const sr = await resolveSkill.execute({ skillId: sid })
        if (sr.ok && sr.value) {
          if (sr.value.systemPrompt) skillPrompts.push(sr.value.systemPrompt)
          sr.value.toolIds.forEach((t) => toolIds.add(t))
        }
      }
      const systemPrompt = [assembleSystemPrompt({ agentName: resolved.name }), ...resolved.systemPromptFragments, ...skillPrompts]
        .filter(Boolean)
        .join('\n\n')
      return { id: resolved.id, name: resolved.name, systemPrompt, modelId: resolved.modelId, toolIds: [...toolIds], skillPrompts }
    },
  }
  void DefaultAgentDirectory
  const subagentRunner = new StaticSubagentRunner()
  const confirmationBroker = new InMemoryConfirmationBroker()
  // ACL bridge: assistant SessionStore -> conversations.ManageSession (the Claude
  // Agent session id persisted on the conversations-owned `conversations` row).
  const sessionStore: AssistantSessionStore = {
    getSessionId: (conversationId) => manageSession.getSessionId(conversationId),
    saveSessionId: (conversationId, sessionId, expectedPrevious) =>
      manageSession.saveSessionId({ conversationId, sessionId, expectedPrevious: expectedPrevious ?? null }),
    clearSessionId: (conversationId) => manageSession.clearSessionId(conversationId),
  }
  const spendStore = new RedisSpendStore(redis)
  // Fulfill the runInference holder now that toolBox + spendStore exist; this
  // back-fills the email AiDrafter and tasks AgentRunner bridges declared earlier.
  const batchRuntime = new ClaudeBatchRuntime(toolBox)
  ai.run = new RunInferenceService(batchRuntime, toolBox, clock, spendStore)
  const chatRuntime = new ClaudeAgentRuntime(toolBox)
  const chat = new ChatHandlerService(chatRuntime, assistantConversationGateway, agentDirectory, sessionStore, spendStore, confirmationBroker, subagentRunner)
  const sendMessage = new SendMessageService(new InMemoryConversationRepository(), new StubAgentRuntime(), toolBox)
  const assistantCtl = assistantConversationController({ send: sendMessage })

  return {
    controller: assistantCtl,
    mcpTools,
    http: { chat },
  }
}

export type AssistantWiring = ReturnType<typeof wireAssistant>
