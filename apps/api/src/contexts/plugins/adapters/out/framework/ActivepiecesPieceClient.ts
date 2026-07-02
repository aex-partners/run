import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import {
  PieceClient,
  PieceCall,
  PieceTriggerCall,
  PieceTriggerResult,
} from '@/contexts/plugins/application/ports/out/PieceClient'
import {
  PluginStoreRepository,
  PluginStoreRef,
} from '@/contexts/plugins/application/ports/out/PluginStoreRepository'
import { PluginStoreScope } from '@/contexts/plugins/domain/PluginStoreScope'
import { PluginStoreEntry } from '@/contexts/plugins/domain/PluginStoreEntry'
import { loadFrameworkPiece } from '@/contexts/plugins/adapters/out/framework/loadFrameworkPiece'

// REAL driven adapter for the PieceClient port. Loads the piece via the shared
// framework loader, builds a genuine ActionContext / TriggerContext (propsValue
// from the call input, auth from the resolved credential, a project- or flow-
// scoped Store backed by the PluginStoreRepository, a minimal FilesService /
// ServerContext) and runs `action.run` / dispatches the trigger hook. Ports the
// semantics of the source `pieces/invoke-piece-action.ts` +
// `pieces/invoke-piece-trigger.ts` (including the auth gate: a piece that declares
// auth AND an action/trigger that requires it fails fast when no credential
// resolved). StubPieceClient stays for the demo; this is its production sibling.

interface ScheduleSpec {
  cronExpression: string
  timezone?: string
}

export class ActivepiecesPieceClient implements PieceClient {
  constructor(
    private readonly store: PluginStoreRepository,
    private readonly clock: Clock,
    // Server URL surfaced to pieces (source uses API_URL; same default).
    private readonly serverUrl: string = process.env.API_URL ?? 'http://localhost:3001',
  ) {}

  async call(req: PieceCall): Promise<Result<Json>> {
    const piece = await loadFrameworkPiece(req.pieceId)
    if (!piece) return fail(`Piece "${req.pieceId}" not found or not installed`)

    let actions: Record<string, { run?: (ctx: unknown) => Promise<unknown>; requireAuth?: boolean }>
    try {
      actions = piece.actions()
    } catch {
      return fail(`Piece "${req.pieceId}" exposes no actions`)
    }

    const action = actions[req.action]
    if (!action || typeof action.run !== 'function') {
      return fail(`Action "${req.action}" not found in piece "${req.pieceId}"`)
    }

    const auth = req.auth ?? null
    // Auth gate (source invoke-piece-action): only fail when the piece declares an
    // auth schema AND the action requires it AND no credential resolved.
    if (piece.auth != null && action.requireAuth === true && auth == null) {
      return fail(
        `Action "${req.action}" in piece "${req.pieceId}" requires a credential but none is configured`,
      )
    }

    const ctx = this.actionContext(req.pieceId, auth, asObject(req.input))
    try {
      const output = await action.run({ ...ctx, executionType: 'BEGIN' })
      return ok(toJson(output))
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err))
    }
  }

  async callTrigger(req: PieceTriggerCall): Promise<Result<PieceTriggerResult>> {
    const piece = await loadFrameworkPiece(req.pieceId)
    if (!piece) return fail(`Piece "${req.pieceId}" not found or not installed`)

    let triggers: ReturnType<NonNullable<typeof piece.triggers>>
    try {
      triggers = piece.triggers()
    } catch {
      return fail(`Piece "${req.pieceId}" exposes no triggers`)
    }

    const trigger = triggers[req.triggerName]
    if (!trigger) return fail(`Trigger "${req.triggerName}" not found in piece "${req.pieceId}"`)

    const auth = req.auth ?? null
    if (piece.auth != null && trigger.requireAuth === true && auth == null) {
      return fail(
        `Trigger "${req.triggerName}" in piece "${req.pieceId}" requires a credential but none is configured`,
      )
    }

    // Holder (not a bare `let`): a piece declares its poll cron via setSchedule
    // from inside onEnable; reading a property dodges the closure-assignment CFA
    // quirk that would narrow a plain captured variable.
    const scheduleHolder: { value: ScheduleSpec | null } = { value: null }
    const setSchedule = (s: ScheduleSpec): void => {
      scheduleHolder.value = { cronExpression: s.cronExpression, timezone: s.timezone }
    }
    const ctx = this.triggerContext({
      pluginName: req.pieceId,
      flowId: req.flowId,
      auth,
      propsValue: asObject(req.input),
      payload: req.payload,
      webhookUrl: req.webhookUrl,
      setSchedule,
    })

    // Dispatch exactly one lifecycle hook. `run` emits items; onEnable/onDisable
    // perform subscription work and emit nothing.
    const hook =
      req.hook === 'onEnable' ? trigger.onEnable : req.hook === 'onDisable' ? trigger.onDisable : trigger.run

    let items: Json[] = []
    try {
      if (typeof hook === 'function') {
        const result = await hook(ctx)
        if (Array.isArray(result)) items = result.map(toJson)
      }
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err))
    }

    const out: PieceTriggerResult = { items }
    const schedule = scheduleHolder.value
    if (schedule?.cronExpression) out.scheduledCron = schedule.cronExpression
    if (schedule?.timezone) out.scheduledTimezone = schedule.timezone
    if (trigger.type !== undefined) out.strategy = trigger.type
    return ok(out)
  }

  // ---- context builders (source context-factory / trigger-context-factory) ----

  private actionContext(pluginName: string, auth: JsonObject | null, propsValue: JsonObject): Record<string, unknown> {
    return {
      auth,
      propsValue,
      store: this.makeStore(pluginName, null, null),
      connections: { get: async () => auth },
      files: { write: async () => '' },
      server: { apiUrl: this.serverUrl, publicUrl: this.serverUrl, token: '' },
      project: { id: 'default', externalId: undefined },
      run: { id: 'inline', stop: async () => {}, pause: async () => {} },
      flows: {
        list: async () => ({ data: [], next: null, previous: null }),
        current: {
          id: 'inline',
          version: { id: 'inline', flowId: 'inline', displayName: '', trigger: {}, state: 'locked', valid: true },
        },
      },
      tags: { add: async () => {} },
      output: { set: async () => {} },
      agent: undefined,
      generateResumeUrl: async () => '',
      step: { name: 'inline', type: 'PIECE' },
    }
  }

  private triggerContext(o: {
    pluginName: string
    flowId: string
    auth: JsonObject | null
    propsValue: JsonObject
    payload?: Json
    webhookUrl?: string
    setSchedule: (s: ScheduleSpec) => void
  }): Record<string, unknown> {
    return {
      auth: o.auth,
      propsValue: o.propsValue,
      store: this.makeStore(o.pluginName, 'flow', o.flowId),
      connections: { get: async () => o.auth },
      files: { write: async () => '' },
      server: { apiUrl: this.serverUrl, publicUrl: this.serverUrl, token: '' },
      project: { id: 'default', externalId: async () => undefined },
      step: { name: 'trigger' },
      flows: {
        list: async () => ({ data: [], next: null, previous: null }),
        current: { id: o.flowId, version: { id: o.flowId } },
      },
      setSchedule: o.setSchedule,
      webhookUrl: o.webhookUrl ?? '',
      payload: o.payload,
      app: { createListeners: () => {} },
    }
  }

  // Framework `Store` backed by the PluginStoreRepository. For an action the scope
  // follows the caller's StoreScope arg (FLOW === 1, else project) with a null
  // scopeId, mirroring the source `createStore`; for a trigger the scope is forced
  // to (flow, flowId), mirroring `createFlowScopedStore`. `put` upserts by the
  // composite (pluginName, scope, scopeId, key).
  private makeStore(pluginName: string, fixedScope: PluginStoreScope | null, fixedScopeId: string | null) {
    const refFor = (key: string, scopeArg: unknown): PluginStoreRef => ({
      pluginName,
      scope: fixedScope ?? (scopeArg === 1 ? 'flow' : 'project'),
      scopeId: fixedScope ? fixedScopeId : null,
      key,
    })

    return {
      put: async (key: string, value: unknown, scopeArg?: unknown): Promise<unknown> => {
        const ref = refFor(key, scopeArg)
        await this.store.put(
          PluginStoreEntry.create({
            id: this.store.nextId(),
            pluginName: ref.pluginName,
            scope: ref.scope,
            scopeId: ref.scopeId,
            key: ref.key,
            value: toJson(value),
            now: this.clock.now(),
          }),
        )
        return value
      },
      get: async (key: string, scopeArg?: unknown): Promise<unknown> => {
        const entry = await this.store.get(refFor(key, scopeArg))
        return entry ? entry.value : null
      },
      delete: async (key: string, scopeArg?: unknown): Promise<void> => {
        await this.store.delete(refFor(key, scopeArg))
      },
    }
  }
}

// Coerce a Json call input into the object the framework expects as propsValue.
function asObject(input: Json): JsonObject {
  return isJsonObject(input) ? input : {}
}

// Coerce an arbitrary piece return value into the Json algebra (drops anything
// non-serializable). Pieces return JSON-ish data; this is the boundary cast.
function toJson(value: unknown): Json {
  if (value === undefined) return null
  try {
    return JSON.parse(JSON.stringify(value)) as Json
  } catch {
    return null
  }
}
