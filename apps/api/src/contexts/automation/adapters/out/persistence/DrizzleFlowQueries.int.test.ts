import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
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
import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowRun } from '@/contexts/automation/domain/FlowRun'
import { FlowFolder } from '@/contexts/automation/domain/FlowFolder'
import { FlowId, FlowVersionId, FlowRunId, FlowFolderId } from '@/contexts/automation/domain/ids'

// Read-side automation adapters against a REAL Postgres. Scoped to freshly
// created flows/folders (unique ids) so they are parallel-safe and never assume
// empty tables.
describeIntegration('Drizzle automation read queries (integration)', () => {
  let db: Database
  let flowRepo: DrizzleFlowRepository
  let versionRepo: DrizzleFlowVersionRepository
  let runRepo: DrizzleFlowRunRepository
  let folderRepo: DrizzleFlowFolderRepository
  beforeAll(() => {
    db = getTestDb()
    flowRepo = new DrizzleFlowRepository(db)
    versionRepo = new DrizzleFlowVersionRepository(db)
    runRepo = new DrizzleFlowRunRepository(db)
    folderRepo = new DrizzleFlowFolderRepository(db)
  })

  const newFlow = async (): Promise<Flow> => {
    const flow = Flow.create({ id: FlowId.of(`flow-${randomUUID()}`), createdBy: null, now: new Date('2024-01-01') })
    await flowRepo.save(flow)
    return flow
  }

  const addVersion = async (flow: Flow, displayName: string, now: Date): Promise<FlowVersion> => {
    const v = FlowVersion.createDraft({
      id: FlowVersionId.of(`ver-${randomUUID()}`),
      flowId: flow.id,
      displayName,
      triggerRaw: '{"type":"EMPTY"}',
      valid: false,
      now,
    })
    await versionRepo.save(v)
    return v
  }

  it('DrizzleGetFlow returns the flow with its versions newest-first, else null', async () => {
    const flow = await newFlow()
    const v1 = await addVersion(flow, 'V1', new Date('2024-03-01'))
    const v2 = await addVersion(flow, 'V2', new Date('2024-04-01'))

    const get = new DrizzleGetFlow(db)
    const view = await get.execute({ id: flow.id.value })
    expect(view).not.toBeNull()
    if (!view) return
    expect(view.id).toBe(flow.id.value)
    expect(view.status).toBe('disabled')
    expect(view.versions.map((v) => v.id)).toEqual([v2.id.value, v1.id.value])

    expect(await get.execute({ id: `missing-${randomUUID()}` })).toBeNull()
  })

  it('DrizzleListVersions lists a flow versions newest-first', async () => {
    const flow = await newFlow()
    const v1 = await addVersion(flow, 'V1', new Date('2024-03-01'))
    const v2 = await addVersion(flow, 'V2', new Date('2024-04-01'))

    const list = new DrizzleListVersions(db)
    const rows = await list.execute({ flowId: flow.id.value })
    expect(rows.map((v) => v.id)).toEqual([v2.id.value, v1.id.value])
  })

  it('DrizzleListFlows attaches the latest version displayName (or a default)', async () => {
    const withVersion = await newFlow()
    await addVersion(withVersion, 'Old', new Date('2024-03-01'))
    await addVersion(withVersion, 'Newest', new Date('2024-05-01'))
    const noVersion = await newFlow()

    const list = new DrizzleListFlows(db)
    const all = await list.execute()
    const a = all.find((f) => f.id === withVersion.id.value)
    const b = all.find((f) => f.id === noVersion.id.value)
    expect(a?.displayName).toBe('Newest')
    expect(b?.displayName).toBe('Untitled Flow')
  })

  it('DrizzleGetRun parses the run steps JSON, else null', async () => {
    const flow = await newFlow()
    const run = FlowRun.createPending({
      id: FlowRunId.of(`run-${randomUUID()}`),
      flowId: flow.id,
      flowVersionId: null,
      triggeredBy: 'user',
      triggerPayloadRaw: '{"a":1}',
      now: new Date('2024-05-01'),
    })
    run.start(new Date('2024-05-01T00:01:00Z'))
    run.fail('nope', { stepsRaw: '{"s1":{"status":"FAILED"}}', duration: 7, now: new Date('2024-05-01T00:02:00Z') })
    await runRepo.save(run)

    const get = new DrizzleGetRun(db)
    const view = await get.execute({ runId: run.id.value })
    expect(view?.status).toBe('failed')
    expect(view?.error).toBe('nope')
    expect(view?.steps).toEqual({ s1: { status: 'FAILED' } })

    expect(await get.execute({ runId: `missing-${randomUUID()}` })).toBeNull()
  })

  it('DrizzleListRuns scopes to a flow, newest-first, and honors limit', async () => {
    const flow = await newFlow()
    const mk = async (now: Date): Promise<string> => {
      const run = FlowRun.createPending({
        id: FlowRunId.of(`run-${randomUUID()}`),
        flowId: flow.id,
        flowVersionId: null,
        triggeredBy: 'user',
        triggerPayloadRaw: null,
        now,
      })
      await runRepo.save(run)
      return run.id.value
    }
    const r1 = await mk(new Date('2024-05-01'))
    const r2 = await mk(new Date('2024-06-01'))

    const list = new DrizzleListRuns(db)
    const rows = await list.execute({ flowId: flow.id.value })
    expect(rows.map((r) => r.id)).toEqual([r2, r1]) // newest first

    const limited = await list.execute({ flowId: flow.id.value, limit: 1 })
    expect(limited.map((r) => r.id)).toEqual([r2])
  })

  it('DrizzleListFolders returns folders ordered by displayOrder', async () => {
    const first = FlowFolder.create({ id: FlowFolderId.of(`fld-${randomUUID()}`), displayName: 'First', displayOrder: 1, now: new Date() })
    const later = FlowFolder.create({ id: FlowFolderId.of(`fld-${randomUUID()}`), displayName: 'Later', displayOrder: 90000, now: new Date() })
    await folderRepo.save(later)
    await folderRepo.save(first)

    const list = new DrizzleListFolders(db)
    const rows = await list.execute()
    const idxFirst = rows.findIndex((f) => f.id === first.id.value)
    const idxLater = rows.findIndex((f) => f.id === later.id.value)
    expect(idxFirst).toBeGreaterThanOrEqual(0)
    expect(idxLater).toBeGreaterThan(idxFirst) // ordered by displayOrder asc
  })
})
