// Wiring for the `automation` context (flow engine). Two ACL bridges to plugins:
// TriggerRegistry -> InvokePieceTrigger (enable/disable/poll piece triggers) and
// PieceGateway -> ResolvePieceAction (run a piece step with credential resolution).
// Exposes runFlow + pollTriggers (workers) and the flow webhook receiver (raw HTTP).
import { Json } from '@/shared/domain/Json'
import { isJsonObject } from '@/shared/domain/Json'
import { Infra } from '@/main/wiring/infra'
import { PluginsCredentialsWiring } from '@/main/wiring/pluginsCredentials'

import { DrizzleFlowRepository } from '@/contexts/automation/adapters/out/persistence/DrizzleFlowRepository'
import { DrizzleFlowVersionRepository } from '@/contexts/automation/adapters/out/persistence/DrizzleFlowVersionRepository'
import { DrizzleFlowRunRepository } from '@/contexts/automation/adapters/out/persistence/DrizzleFlowRunRepository'
import { DrizzleFlowFolderRepository } from '@/contexts/automation/adapters/out/persistence/DrizzleFlowFolderRepository'
import { DrizzleGetFlow } from '@/contexts/automation/adapters/out/persistence/DrizzleGetFlow'
import { DrizzleGetRun } from '@/contexts/automation/adapters/out/persistence/DrizzleGetRun'
import { DrizzleListFlows } from '@/contexts/automation/adapters/out/persistence/DrizzleListFlows'
import { DrizzleListFolders } from '@/contexts/automation/adapters/out/persistence/DrizzleListFolders'
import { DrizzleListRuns } from '@/contexts/automation/adapters/out/persistence/DrizzleListRuns'
import { DrizzleListVersions } from '@/contexts/automation/adapters/out/persistence/DrizzleListVersions'
import { InMemoryEngineEventStore } from '@/contexts/automation/adapters/out/persistence/InMemoryEngineEventStore'
import { WorkerCodeSandbox } from '@/contexts/automation/adapters/out/sandbox/WorkerCodeSandbox'
import { BullMqScheduler } from '@/contexts/automation/adapters/out/scheduler/BullMqScheduler'
import { TriggerRegistry } from '@/contexts/automation/application/ports/out/TriggerRegistry'
import { FlowEngineInterpreter } from '@/contexts/automation/application/use-cases/FlowEngineInterpreter'
import { CreateFlowService } from '@/contexts/automation/application/use-cases/CreateFlowService'
import { DeleteFlowService } from '@/contexts/automation/application/use-cases/DeleteFlowService'
import { MoveFlowService } from '@/contexts/automation/application/use-cases/MoveFlowService'
import { UpdateFlowService } from '@/contexts/automation/application/use-cases/UpdateFlowService'
import { TriggerLifecycleService } from '@/contexts/automation/application/use-cases/TriggerLifecycleService'
import { PublishVersionService } from '@/contexts/automation/application/use-cases/PublishVersionService'
import { RestoreVersionService } from '@/contexts/automation/application/use-cases/RestoreVersionService'
import { SaveVersionService } from '@/contexts/automation/application/use-cases/SaveVersionService'
import { ValidateVersionService } from '@/contexts/automation/application/use-cases/ValidateVersionService'
import { TriggerFlowService } from '@/contexts/automation/application/use-cases/TriggerFlowService'
import { HandleWebhookService as AutomationHandleWebhookService } from '@/contexts/automation/application/use-cases/HandleWebhookService'
import { PollTriggersService } from '@/contexts/automation/application/use-cases/PollTriggersService'
import { RunFlowService } from '@/contexts/automation/application/use-cases/RunFlowService'
import {
  FolderService,
  createFolderPort,
  deleteFolderPort,
  renameFolderPort,
  reorderFoldersPort,
} from '@/contexts/automation/application/use-cases/FolderService'
import { aexFlowController } from '@/contexts/automation/adapters/in/http/AexFlowController'
import { makeWebhookReceiver } from '@/contexts/automation/adapters/in/webhook/WebhookReceiver'
import { PieceGateway } from '@/contexts/automation/application/ports/out/PieceGateway'

type AutomationDeps = Pick<PluginsCredentialsWiring['ports'], 'invokePieceTrigger' | 'resolvePieceAction'>

export function wireAutomation(infra: Infra, deps: AutomationDeps) {
  const { db, clock, bullConnection } = infra
  const { invokePieceTrigger, resolvePieceAction } = deps

  const flowRepo = new DrizzleFlowRepository(db)
  const flowVersionRepo = new DrizzleFlowVersionRepository(db)
  const flowRunRepo = new DrizzleFlowRunRepository(db)
  const flowFolderRepo = new DrizzleFlowFolderRepository(db)
  const getFlow = new DrizzleGetFlow(db)
  const getRun = new DrizzleGetRun(db)
  const listFlows = new DrizzleListFlows(db)
  const listFolders = new DrizzleListFolders(db)
  const listRuns = new DrizzleListRuns(db)
  const listVersions = new DrizzleListVersions(db)
  const engineEventStore = new InMemoryEngineEventStore()
  const codeSandbox = new WorkerCodeSandbox()
  const flowScheduler = new BullMqScheduler(bullConnection)
  // ACL bridge: automation TriggerRegistry -> plugins InvokePieceTrigger
  // (onEnable/onDisable/run). Unwraps the action-dependent Json result.
  const triggerRegistry: TriggerRegistry = {
    enable: async (ref) => {
      const r = await invokePieceTrigger.execute({
        pieceName: ref.pieceName, triggerName: ref.triggerName, action: 'onEnable', input: ref.input, context: { flowId: ref.flowId },
      })
      if (!r.ok || typeof r.value !== 'object' || r.value === null || Array.isArray(r.value)) return {}
      const v = r.value as Record<string, Json>
      return {
        strategy: typeof v.strategy === 'string' ? v.strategy : undefined,
        scheduledCron: typeof v.scheduledCron === 'string' ? v.scheduledCron : undefined,
      }
    },
    disable: async (ref) => {
      await invokePieceTrigger.execute({
        pieceName: ref.pieceName, triggerName: ref.triggerName, action: 'onDisable', input: ref.input, context: { flowId: ref.flowId },
      })
    },
    poll: async (ref) => {
      const r = await invokePieceTrigger.execute({
        pieceName: ref.pieceName, triggerName: ref.triggerName, action: 'run', input: ref.input, context: { flowId: ref.flowId },
      })
      return { items: r.ok && Array.isArray(r.value) ? r.value : [] }
    },
  }
  // ACL bridge: automation PieceGateway -> plugins InvokePiece.
  // Bridge automation PieceGateway -> plugins ResolvePieceAction (the real runner
  // with credential resolution + auth gate), mapping the step's pieceId/action.
  const pieceGateway: PieceGateway = {
    invoke: (call) =>
      resolvePieceAction.execute({
        pieceName: call.pieceId,
        actionName: call.action,
        input: isJsonObject(call.input) ? call.input : {},
        credentialId: call.credentialId,
      }),
  }
  const flowInterpreter = new FlowEngineInterpreter(pieceGateway, codeSandbox, engineEventStore)
  const triggerLifecycle = new TriggerLifecycleService(flowRepo, flowVersionRepo, flowScheduler, triggerRegistry)
  const createFlow = new CreateFlowService(flowRepo, flowVersionRepo, clock)
  const deleteFlow = new DeleteFlowService(flowRepo)
  const moveFlow = new MoveFlowService(flowRepo, flowFolderRepo, clock)
  const updateFlow = new UpdateFlowService(flowRepo, triggerLifecycle, clock)
  const publishVersion = new PublishVersionService(flowRepo, flowVersionRepo, clock)
  const restoreVersion = new RestoreVersionService(flowRepo, flowVersionRepo, clock)
  const saveVersion = new SaveVersionService(flowVersionRepo, clock)
  const validateVersion = new ValidateVersionService()
  const triggerFlow = new TriggerFlowService(flowRepo, flowVersionRepo, flowRunRepo, flowScheduler, clock)
  const handleFlowWebhook = new AutomationHandleWebhookService(flowRepo, flowVersionRepo, flowRunRepo, flowScheduler, clock)
  const pollTriggers = new PollTriggersService(flowRepo, flowVersionRepo, flowRunRepo, flowScheduler, triggerRegistry, clock)
  const runFlow = new RunFlowService(flowRunRepo, flowVersionRepo, flowInterpreter, clock)
  const folderService = new FolderService(flowFolderRepo, clock)
  const flowsCtl = aexFlowController({
    create: createFlow, update: updateFlow, remove: deleteFlow, move: moveFlow, saveVersion,
    validateVersion,
    publish: publishVersion, restoreVersion, trigger: triggerFlow,
    createFolder: createFolderPort(folderService), deleteFolder: deleteFolderPort(folderService),
    renameFolder: renameFolderPort(folderService), reorderFolders: reorderFoldersPort(folderService),
    list: listFlows, getById: getFlow, listVersions, listRuns, getRun, listFolders,
  })
  const flowWebhookReceiver = makeWebhookReceiver(handleFlowWebhook)

  return {
    controller: flowsCtl,
    ports: { runFlow, pollTriggers },
    http: { flowWebhookReceiver },
  }
}

export type AutomationWiring = ReturnType<typeof wireAutomation>
