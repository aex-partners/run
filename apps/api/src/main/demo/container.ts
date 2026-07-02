// OFFLINE DEMO composition root (in-memory, zero DB/Redis). The real DB-backed
// composition root lives in ../container.ts. This one stays so the end-to-end
// smoke test (`npm run demo`) can run with no Postgres/Redis. It is the ONLY
// place (besides the real container) allowed to import across contexts: it
// instantiates in-memory adapters, injects them into use cases, and fulfills
// ACL out-ports by bridging to another context's in-port.
import { SystemClock } from '@/platform/runtime/SystemClock'
import { ConsoleEventPublisher } from '@/platform/events/ConsoleEventPublisher'
import { ToolDefinition } from '@/platform/ai-runtime/tool'

// --- data
import { InMemoryEntityRepository } from '@/contexts/data/adapters/out/persistence/InMemoryEntityRepository'
import { InMemoryRecordStore } from '@/contexts/data/adapters/out/persistence/InMemoryRecordStore'
import { InMemoryRecordRepository } from '@/contexts/data/adapters/out/persistence/InMemoryRecordRepository'
import { InMemoryListRecords } from '@/contexts/data/adapters/out/persistence/InMemoryListRecords'
import { CreateEntityService } from '@/contexts/data/application/use-cases/CreateEntityService'
import { AddFieldService } from '@/contexts/data/application/use-cases/AddFieldService'
import { InsertRecordService } from '@/contexts/data/application/use-cases/InsertRecordService'
import { UpdateRecordService } from '@/contexts/data/application/use-cases/UpdateRecordService'
import { createEntityTool } from '@/contexts/data/adapters/in/mcp/CreateEntityTool'
import { insertRecordTool } from '@/contexts/data/adapters/in/mcp/InsertRecordTool'

// --- plugins
import { StubPieceClient } from '@/contexts/plugins/adapters/out/http/StubPieceClient'
import { InvokePieceService } from '@/contexts/plugins/application/use-cases/InvokePieceService'

// --- automation
import { InMemoryFlowRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowRepository'
import { InMemoryRunEventStore } from '@/contexts/automation/adapters/out/persistence/InMemoryRunEventStore'
import { EchoCodeSandbox } from '@/contexts/automation/adapters/out/sandbox/EchoCodeSandbox'
import { FlowInterpreter } from '@/contexts/automation/application/use-cases/FlowInterpreter'
import { StartFlowService } from '@/contexts/automation/application/use-cases/StartFlowService'
import { PieceGateway } from '@/contexts/automation/application/ports/out/PieceGateway'

// --- assistant
import { StubAgentRuntime } from '@/contexts/assistant/adapters/out/llm/StubAgentRuntime'
import { InMemoryConversationRepository } from '@/contexts/assistant/adapters/out/persistence/InMemoryConversationRepository'
import { SendMessageService } from '@/contexts/assistant/application/use-cases/SendMessageService'
import { ToolBox } from '@/contexts/assistant/application/ports/out/ToolBox'

export function buildContainer() {
  const clock = new SystemClock()
  const events = new ConsoleEventPublisher()

  // ---- data context
  const entityRepo = new InMemoryEntityRepository()
  const recordStore = new InMemoryRecordStore()
  const recordRepo = new InMemoryRecordRepository(recordStore)
  const listRecords = new InMemoryListRecords(recordStore)

  const createEntity = new CreateEntityService(entityRepo, events, clock)
  const addField = new AddFieldService(entityRepo, events, clock)
  const insertRecord = new InsertRecordService(entityRepo, recordRepo, events, clock)
  const updateRecord = new UpdateRecordService(entityRepo, recordRepo, events, clock)

  // data exposes MCP tools (driving adapters over its own in-ports)
  const dataTools: ToolDefinition[] = [
    createEntityTool(createEntity),
    insertRecordTool(insertRecord),
  ]

  // ---- plugins context
  const invokePiece = new InvokePieceService(new StubPieceClient())

  // ---- automation context
  // ACL bridge: automation's PieceGateway -> plugins InvokePiece in-port.
  const pieceGateway: PieceGateway = {
    invoke: (call) => invokePiece.execute(call),
  }
  const flowRepo = new InMemoryFlowRepository()
  const interpreter = new FlowInterpreter(pieceGateway, new EchoCodeSandbox(), new InMemoryRunEventStore())
  const startFlow = new StartFlowService(flowRepo, interpreter)

  // ---- assistant context
  // ACL bridge: assistant's ToolBox -> the data context's MCP tools. The AI thus
  // reuses data's in-ports without assistant importing the data context.
  const toolIndex = new Map(dataTools.map((t) => [t.name, t]))
  const toolBox: ToolBox = {
    names: () => [...toolIndex.keys()],
    execute: async (name, input) => {
      const tool = toolIndex.get(name)
      if (!tool) return { ok: false, error: `unknown tool "${name}"` }
      return tool.execute(input)
    },
  }
  const sendMessage = new SendMessageService(new InMemoryConversationRepository(), new StubAgentRuntime(), toolBox)

  return {
    data: { createEntity, addField, insertRecord, updateRecord, listRecords },
    automation: { flowRepo, startFlow },
    assistant: { sendMessage },
  }
}

export type Container = ReturnType<typeof buildContainer>
