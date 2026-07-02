import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import { DrizzleFlowRepository } from '@/contexts/automation/adapters/out/persistence/DrizzleFlowRepository'
import { DrizzleFlowVersionRepository } from '@/contexts/automation/adapters/out/persistence/DrizzleFlowVersionRepository'
import { DrizzleFlowRunRepository } from '@/contexts/automation/adapters/out/persistence/DrizzleFlowRunRepository'
import { DrizzleFlowFolderRepository } from '@/contexts/automation/adapters/out/persistence/DrizzleFlowFolderRepository'
import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowRun } from '@/contexts/automation/domain/FlowRun'
import { FlowFolder } from '@/contexts/automation/domain/FlowFolder'
import { FlowId, FlowVersionId, FlowRunId, FlowFolderId } from '@/contexts/automation/domain/ids'

// Automation driven adapters against a REAL Postgres. flows.created_by is a
// nullable FK; we leave it null to avoid seeding users. flow_versions/runs hang
// off a flow row (FK), so a flow is saved first. Unique ids keep tests
// parallel-safe.
describeIntegration('Drizzle automation repositories (integration)', () => {
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

  it('DrizzleFlowRepository round-trips a flow and upserts status/folder/published on save', async () => {
    const flow = await newFlow()
    const initial = await flowRepo.findById(flow.id)
    expect(initial).not.toBeNull()
    if (!initial) return
    expect(initial.status).toBe('disabled')
    expect(initial.folderId).toBeNull()
    expect(initial.publishedVersionId).toBeNull()

    const folder = FlowFolder.create({ id: FlowFolderId.of(`fld-${randomUUID()}`), displayName: 'F', now: new Date() })
    await folderRepo.save(folder)

    flow.moveToFolder(folder.id.value, new Date('2024-02-01'))
    flow.enable(new Date('2024-02-01'))
    flow.publish('ver-1', new Date('2024-02-01'))
    await flowRepo.save(flow)

    const updated = await flowRepo.findById(flow.id)
    expect(updated?.status).toBe('enabled')
    expect(updated?.folderId).toBe(folder.id.value)
    expect(updated?.publishedVersionId).toBe('ver-1')

    await flowRepo.delete(flow.id)
    expect(await flowRepo.findById(flow.id)).toBeNull()
  })

  it('DrizzleFlowVersionRepository handles draft lifecycle, scoping, latest, list, deleteDrafts', async () => {
    const flow = await newFlow()
    const other = await newFlow()

    const draft = FlowVersion.createDraft({
      id: FlowVersionId.of(`ver-${randomUUID()}`),
      flowId: flow.id,
      displayName: 'Draft 1',
      triggerRaw: '{"type":"EMPTY"}',
      valid: false,
      now: new Date('2024-03-01'),
    })
    await versionRepo.save(draft)

    const found = await versionRepo.findById(draft.id)
    expect(found?.displayName).toBe('Draft 1')
    expect(found?.state).toBe('draft')
    expect(found?.valid).toBe(false)
    expect(found?.triggerRaw).toBe('{"type":"EMPTY"}')

    // Version is scoped to its flow.
    expect(await versionRepo.findByIdForFlow(draft.id, flow.id)).not.toBeNull()
    expect(await versionRepo.findByIdForFlow(draft.id, other.id)).toBeNull()
    expect((await versionRepo.findDraft(flow.id))?.id.value).toBe(draft.id.value)

    // Edit the draft in place.
    const upd = found!.updateDraft({ displayName: 'Draft 1b', triggerRaw: '{"type":"WEBHOOK"}', valid: true, now: new Date() })
    expect(upd.ok).toBe(true)
    await versionRepo.save(found!)
    expect((await versionRepo.findById(draft.id))?.displayName).toBe('Draft 1b')

    // Lock it (publish) -> no longer a draft.
    found!.lock(new Date())
    await versionRepo.save(found!)
    expect((await versionRepo.findById(draft.id))?.state).toBe('locked')
    expect(await versionRepo.findDraft(flow.id)).toBeNull()

    // Add a newer draft; listForFlow + findLatest order by createdAt desc.
    const draft2 = FlowVersion.createDraft({
      id: FlowVersionId.of(`ver-${randomUUID()}`),
      flowId: flow.id,
      displayName: 'Draft 2',
      triggerRaw: '{}',
      valid: false,
      now: new Date('2024-04-01'),
    })
    await versionRepo.save(draft2)

    const list = await versionRepo.listForFlow(flow.id)
    expect(list.map((v) => v.id.value)).toEqual([draft2.id.value, draft.id.value])
    expect((await versionRepo.findLatest(flow.id))?.id.value).toBe(draft2.id.value)

    // deleteDrafts removes the draft but keeps the locked version.
    await versionRepo.deleteDrafts(flow.id)
    expect(await versionRepo.findById(draft2.id)).toBeNull()
    expect((await versionRepo.findById(draft.id))?.state).toBe('locked')
  })

  it('DrizzleFlowRunRepository round-trips a run through pending -> running -> failed', async () => {
    const flow = await newFlow()
    const run = FlowRun.createPending({
      id: FlowRunId.of(`run-${randomUUID()}`),
      flowId: flow.id,
      flowVersionId: null,
      triggeredBy: 'user',
      triggerPayloadRaw: '{"x":1}',
      now: new Date('2024-05-01'),
    })
    await runRepo.save(run)

    const pending = await runRepo.findById(run.id)
    expect(pending?.status).toBe('pending')
    expect(pending?.triggeredBy).toBe('user')
    expect(pending?.triggerPayloadRaw).toBe('{"x":1}')
    expect(pending?.stepsRaw).toBe('{}')
    expect(pending?.tagsRaw).toBe('[]')

    run.start(new Date('2024-05-01T00:01:00Z'))
    await runRepo.save(run)
    const running = await runRepo.findById(run.id)
    expect(running?.status).toBe('running')
    expect(running?.startedAt).not.toBeNull()

    run.fail('boom', { stepsRaw: '{"step1":{"status":"FAILED"}}', duration: 42, now: new Date('2024-05-01T00:02:00Z') })
    await runRepo.save(run)
    const failed = await runRepo.findById(run.id)
    expect(failed?.status).toBe('failed')
    expect(failed?.error).toBe('boom')
    expect(failed?.duration).toBe(42)
    expect(failed?.completedAt).not.toBeNull()
  })

  it('DrizzleFlowFolderRepository round-trips a folder with rename + reorder', async () => {
    const folder = FlowFolder.create({ id: FlowFolderId.of(`fld-${randomUUID()}`), displayName: 'Marketing', now: new Date() })
    await folderRepo.save(folder)

    const found = await folderRepo.findById(folder.id)
    expect(found?.displayName).toBe('Marketing')
    expect(found?.displayOrder).toBe(0)

    found!.rename('Sales')
    found!.reorder(3)
    await folderRepo.save(found!)
    const updated = await folderRepo.findById(folder.id)
    expect(updated?.displayName).toBe('Sales')
    expect(updated?.displayOrder).toBe(3)

    await folderRepo.delete(folder.id)
    expect(await folderRepo.findById(folder.id)).toBeNull()
  })
})
