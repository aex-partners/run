import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { describeIntegration, getTestDb, resetDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { Result } from '@/shared/kernel/Result'

// ---------------------------------------------------------------------------
// CONSOLIDATED adapter-integration suite for the tasks / reminders / identity /
// credentials contexts, intentionally kept in ONE file.
//
// WHY ONE FILE: the shared `resetDb` helper TRUNCATEs every public table in
// `beforeEach`. vitest runs separate test FILES in parallel worker threads, so
// two .int.test.ts files hitting the same Postgres would truncate each other's
// rows mid-test (verified: catastrophic cross-file interference). Tests within a
// single file run sequentially, so consolidating keeps every suite isolated and
// the assertions exact. Run with the project's dedicated DB, e.g.:
//   TEST_DATABASE_URL=postgres://aex:aex@localhost:55432/aex_test_b npx vitest run src/contexts
// Without TEST_DATABASE_URL every block below skips (describeIntegration).
// ---------------------------------------------------------------------------

const must = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(`expected ok Result, got: ${r.error}`)
  return r.value
}

// Raw FK-prereq seed: identity owns the `users` table; tasks/reminders/credentials
// all reference users.id, so seed users via a direct insert first.
const seedUser = (
  db: Database,
  id: string,
  over: Partial<typeof schema.users.$inferInsert> = {},
) =>
  db.insert(schema.users).values({
    id,
    name: over.name ?? `User ${id}`,
    email: over.email ?? `${id}@example.com`,
    ...over,
  })

// ===========================================================================
// TASKS
// ===========================================================================

describeIntegration('tasks adapters', () => {
  let db: Database
  beforeAll(() => {
    db = getTestDb()
  })
  beforeEach(() => resetDb(db))

  const NOW = new Date('2026-06-30T12:00:00.000Z')

  // Lazily imported so a skipped suite never loads adapter modules.
  const repos = async () => {
    const { DrizzleTaskRepository } = await import(
      '@/contexts/tasks/adapters/out/persistence/DrizzleTaskRepository'
    )
    const { DrizzleTaskAssigneeRepository } = await import(
      '@/contexts/tasks/adapters/out/persistence/DrizzleTaskAssigneeRepository'
    )
    const { DrizzleTaskLogRepository } = await import(
      '@/contexts/tasks/adapters/out/persistence/DrizzleTaskLogRepository'
    )
    const { DrizzleListTasks } = await import('@/contexts/tasks/adapters/out/persistence/DrizzleListTasks')
    const { DrizzleGetTask } = await import('@/contexts/tasks/adapters/out/persistence/DrizzleGetTask')
    const { DrizzleListTaskLogs } = await import(
      '@/contexts/tasks/adapters/out/persistence/DrizzleListTaskLogs'
    )
    const { DrizzleTaskStats } = await import('@/contexts/tasks/adapters/out/persistence/DrizzleTaskStats')
    return {
      taskRepo: new DrizzleTaskRepository(db),
      assigneeRepo: new DrizzleTaskAssigneeRepository(db),
      logRepo: new DrizzleTaskLogRepository(db),
      listTasks: new DrizzleListTasks(db),
      getTask: new DrizzleGetTask(db),
      listLogs: new DrizzleListTaskLogs(db),
      stats: new DrizzleTaskStats(db),
    }
  }

  const buildTask = async (id: string, createdBy: string, title = 'Do the thing') => {
    const { Task } = await import('@/contexts/tasks/domain/Task')
    const { TaskId } = await import('@/contexts/tasks/domain/ids')
    const { TaskKind } = await import('@/contexts/tasks/domain/TaskKind')
    const { TaskExecutor } = await import('@/contexts/tasks/domain/TaskExecutor')
    const { TaskType } = await import('@/contexts/tasks/domain/TaskType')
    return must(
      Task.create({
        id: TaskId.of(id),
        title,
        description: 'desc',
        kind: must(TaskKind.of('task')),
        executor: must(TaskExecutor.of('human')),
        type: must(TaskType.of('inference')),
        createdBy,
        conversationId: null,
        input: 'the input',
        dueAt: null,
        parentTaskId: null,
        agentId: null,
        toolName: null,
        inputSchema: null,
        outputSchema: null,
        structuredInput: null,
        now: NOW,
      }),
    )
  }

  // Raw task insert used for the read-side adapters (seeds rows directly).
  const insertTask = (
    id: string,
    createdBy: string,
    over: Partial<typeof schema.tasks.$inferInsert> = {},
  ) => db.insert(schema.tasks).values({ id, title: `Task ${id}`, createdBy, ...over })

  it('DrizzleTaskRepository round-trips an aggregate through save -> findById', async () => {
    const { taskRepo } = await repos()
    await seedUser(db, 'u1')
    const { TaskId } = await import('@/contexts/tasks/domain/ids')

    const task = await buildTask('t1', 'u1', 'Round trip')
    await taskRepo.save(task)

    const found = await taskRepo.findById(TaskId.of('t1'))
    expect(found).not.toBeNull()
    expect(found?.title).toBe('Round trip')
    expect(found?.status).toBe('pending')
    expect(found?.createdBy).toBe('u1')
    expect(found?.kind.value).toBe('task')
    expect(found?.executor.value).toBe('human')
    expect(found?.type.value).toBe('inference')
    expect(found?.input).toBe('the input')

    expect(await taskRepo.findById(TaskId.of('missing'))).toBeNull()
  })

  it('DrizzleTaskRepository upserts on save (transition is persisted)', async () => {
    const { taskRepo } = await repos()
    await seedUser(db, 'u1')
    const { TaskId } = await import('@/contexts/tasks/domain/ids')

    const task = await buildTask('t1', 'u1')
    await taskRepo.save(task)
    must(task.start(new Date('2026-06-30T13:00:00.000Z')))
    await taskRepo.save(task)

    const found = await taskRepo.findById(TaskId.of('t1'))
    expect(found?.status).toBe('running')
    expect(found?.startedAt).toEqual(new Date('2026-06-30T13:00:00.000Z'))
    // exactly one row (upsert, not insert).
    const rows = await db.select().from(schema.tasks)
    expect(rows.length).toBe(1)
  })

  it('DrizzleTaskAssigneeRepository: save/findOne/listByTask/saveAll + ack upsert', async () => {
    const { assigneeRepo } = await repos()
    await seedUser(db, 'u1')
    await seedUser(db, 'u2')
    await insertTask('t1', 'u1')
    const { TaskAssignee } = await import('@/contexts/tasks/domain/TaskAssignee')
    const { TaskId } = await import('@/contexts/tasks/domain/ids')

    const a1 = TaskAssignee.create('t1', 'u1', NOW)
    const a2 = TaskAssignee.create('t1', 'u2', NOW)
    await assigneeRepo.saveAll([a1, a2])

    const list = await assigneeRepo.listByTask(TaskId.of('t1'))
    expect(list.map((a) => a.userId).sort()).toEqual(['u1', 'u2'])

    const one = await assigneeRepo.findOne(TaskId.of('t1'), 'u1')
    expect(one?.acknowledgedAt).toBeNull()

    // Acknowledge then re-save: composite-key upsert updates interaction columns.
    must(a1.acknowledge(new Date('2026-06-30T14:00:00.000Z')))
    await assigneeRepo.save(a1)
    const acked = await assigneeRepo.findOne(TaskId.of('t1'), 'u1')
    expect(acked?.acknowledgedAt).toEqual(new Date('2026-06-30T14:00:00.000Z'))
    expect(acked?.isAcknowledged()).toBe(true)
    // still two rows (no duplicate from the re-save).
    const rows = await db.select().from(schema.taskAssignees)
    expect(rows.length).toBe(2)
  })

  it('DrizzleTaskLogRepository.append + DrizzleListTaskLogs (oldest-first, metadata)', async () => {
    const { logRepo, listLogs } = await repos()
    await seedUser(db, 'u1')
    await insertTask('t1', 'u1')
    const { TaskLog } = await import('@/contexts/tasks/domain/TaskLog')
    const { TaskLogId, TaskId } = await import('@/contexts/tasks/domain/ids')

    await logRepo.append(
      TaskLog.create(TaskLogId.of('l1'), TaskId.of('t1'), 'info', 'first', { a: 1 }, new Date('2026-06-30T12:00:00Z')),
    )
    await logRepo.append(
      TaskLog.create(TaskLogId.of('l2'), TaskId.of('t1'), 'error', 'second', null, new Date('2026-06-30T12:05:00Z')),
    )

    const logs = await listLogs.execute({ userId: 'u1', taskId: 't1', limit: 10 })
    expect(logs.map((l) => l.message)).toEqual(['first', 'second'])
    expect(logs[0]?.metadata).toBe(JSON.stringify({ a: 1 }))
    expect(logs[1]?.metadata).toBeNull()

    // Visibility guard: a stranger sees no logs for a task they cannot access.
    await seedUser(db, 'stranger')
    expect(await listLogs.execute({ userId: 'stranger', taskId: 't1', limit: 10 })).toEqual([])
  })

  it('DrizzleListTasks / DrizzleGetTask apply the visibleTasksWhere boundary', async () => {
    const { listTasks, getTask } = await repos()
    await seedUser(db, 'u1')
    await seedUser(db, 'u2')
    await seedUser(db, 'u3')
    await insertTask('t1', 'u1', { status: 'pending' })
    await insertTask('t2', 'u2', { status: 'running' }) // u1 is an assignee below
    await insertTask('t3', 'u3', { status: 'pending' }) // not visible to u1
    await db.insert(schema.taskAssignees).values({ taskId: 't2', userId: 'u1' })

    const visible = await listTasks.execute({ userId: 'u1', limit: 50, offset: 0 })
    const ids = visible.map((t) => t.id).sort()
    expect(ids).toEqual(['t1', 't2'])
    expect(ids).not.toContain('t3')

    // assignee ids are joined into the view.
    const t2view = visible.find((t) => t.id === 't2')
    expect(t2view?.assigneeIds).toEqual(['u1'])

    // status filter.
    const pending = await listTasks.execute({ userId: 'u1', status: 'pending', limit: 50, offset: 0 })
    expect(pending.map((t) => t.id)).toEqual(['t1'])

    // GetTask honours the same boundary.
    expect(await getTask.execute({ userId: 'u1', id: 't1' })).not.toBeNull()
    expect(await getTask.execute({ userId: 'u1', id: 't3' })).toBeNull()
    expect((await getTask.execute({ userId: 'u1', id: 't2' }))?.assigneeIds).toEqual(['u1'])
  })

  it('DrizzleListTasks scheduledOnly returns future pending tasks soonest-first', async () => {
    const { listTasks } = await repos()
    await seedUser(db, 'u1')
    const soon = new Date(Date.now() + 60 * 60_000)
    const later = new Date(Date.now() + 120 * 60_000)
    await insertTask('later', 'u1', { status: 'pending', scheduledAt: later })
    await insertTask('soon', 'u1', { status: 'pending', scheduledAt: soon })
    await insertTask('past', 'u1', { status: 'pending', scheduledAt: new Date(Date.now() - 60_000) })
    await insertTask('nosched', 'u1', { status: 'pending' })

    const scheduled = await listTasks.execute({ userId: 'u1', scheduledOnly: true, limit: 50, offset: 0 })
    expect(scheduled.map((t) => t.id)).toEqual(['soon', 'later'])
  })

  it('DrizzleTaskStats counts the user visible tasks by status', async () => {
    const { stats } = await repos()
    await seedUser(db, 'u1')
    await seedUser(db, 'u2')
    await insertTask('p', 'u1', { status: 'pending' })
    await insertTask('r', 'u1', { status: 'running' })
    await insertTask('f', 'u1', { status: 'failed' })
    await insertTask('c', 'u1', { status: 'completed', completedAt: new Date() })
    await insertTask('other', 'u2', { status: 'running' }) // not u1's
    // a completed task assigned to u1 (visible via assignee), completed today.
    await insertTask('cAssigned', 'u2', { status: 'completed', completedAt: new Date() })
    await db.insert(schema.taskAssignees).values({ taskId: 'cAssigned', userId: 'u1' })

    const s = await stats.execute({ userId: 'u1' })
    expect(s.pending).toBe(1)
    expect(s.running).toBe(1)
    expect(s.failed).toBe(1)
    expect(s.completedToday).toBe(2)
  })
})

// ===========================================================================
// REMINDERS
// ===========================================================================

describeIntegration('reminders adapters', () => {
  let db: Database
  beforeAll(() => {
    db = getTestDb()
  })
  beforeEach(() => resetDb(db))

  const NOW = new Date('2026-06-30T12:00:00.000Z')

  const make = async () => {
    const { DrizzleReminderRepository } = await import(
      '@/contexts/reminders/adapters/out/persistence/DrizzleReminderRepository'
    )
    const { DrizzleListReminders } = await import(
      '@/contexts/reminders/adapters/out/persistence/DrizzleListReminders'
    )
    return { repo: new DrizzleReminderRepository(db), list: new DrizzleListReminders(db) }
  }

  it('DrizzleReminderRepository round-trips and persists the fire transition', async () => {
    const { repo } = await make()
    await seedUser(db, 'u1')
    const { Reminder } = await import('@/contexts/reminders/domain/Reminder')
    const { ReminderId } = await import('@/contexts/reminders/domain/ids')

    const reminder = must(
      Reminder.schedule({
        id: ReminderId.of('r1'),
        jobId: 'job-1',
        userId: 'u1',
        conversationId: null,
        message: 'stand up',
        scheduledFor: new Date(NOW.getTime() + 60 * 60_000),
        deliverEmail: true,
        now: NOW,
      }),
    )
    await repo.save(reminder)

    const found = await repo.findById(ReminderId.of('r1'))
    expect(found?.message).toBe('stand up')
    expect(found?.status).toBe('scheduled')
    expect(found?.deliverEmail).toBe(true)
    expect(found?.jobId).toBe('job-1')

    must(found!.fire(new Date('2026-06-30T13:00:00.000Z')))
    await repo.save(found!)
    const fired = await repo.findById(ReminderId.of('r1'))
    expect(fired?.status).toBe('fired')
    expect(fired?.firedAt).toEqual(new Date('2026-06-30T13:00:00.000Z'))
    const rows = await db.select().from(schema.reminders)
    expect(rows.length).toBe(1)
  })

  it('DrizzleListReminders filters by user/status and orders correctly', async () => {
    const { list } = await make()
    await seedUser(db, 'u1')
    await seedUser(db, 'u2')

    await db.insert(schema.reminders).values([
      { id: 'r-later', userId: 'u1', message: 'later', scheduledFor: new Date(NOW.getTime() + 120 * 60_000), status: 'scheduled', createdAt: new Date('2026-06-10T00:00:00Z') },
      { id: 'r-soon', userId: 'u1', message: 'soon', scheduledFor: new Date(NOW.getTime() + 60 * 60_000), status: 'scheduled', createdAt: new Date('2026-06-05T00:00:00Z') },
      { id: 'r-old', userId: 'u1', message: 'old', scheduledFor: NOW, status: 'fired', createdAt: new Date('2026-06-01T00:00:00Z') },
      { id: 'r-new', userId: 'u1', message: 'new', scheduledFor: NOW, status: 'fired', createdAt: new Date('2026-06-20T00:00:00Z') },
      { id: 'r-other', userId: 'u2', message: 'other', scheduledFor: NOW, status: 'scheduled', createdAt: new Date('2026-06-15T00:00:00Z') },
    ])

    // scheduled -> soonest first, only u1's scheduled.
    const scheduled = await list.execute({ userId: 'u1', status: 'scheduled', limit: 10 })
    expect(scheduled.map((r) => r.id)).toEqual(['r-soon', 'r-later'])

    // no status filter -> newest createdAt first.
    const all = await list.execute({ userId: 'u1', limit: 10 })
    expect(all.map((r) => r.id)[0]).toBe('r-new')
    expect(all.every((r) => r.id !== 'r-other')).toBe(true)

    // status scoping.
    const fired = await list.execute({ userId: 'u1', status: 'fired', limit: 10 })
    expect(fired.map((r) => r.id).sort()).toEqual(['r-new', 'r-old'])
  })
})

// ===========================================================================
// IDENTITY
// ===========================================================================

describeIntegration('identity adapters', () => {
  let db: Database
  beforeAll(() => {
    db = getTestDb()
  })
  beforeEach(() => resetDb(db))

  const NOW = new Date('2026-06-30T12:00:00.000Z')

  it('DrizzleUserRepository round-trips invite/rename/status/delete', async () => {
    const { DrizzleUserRepository } = await import(
      '@/contexts/identity/adapters/out/persistence/DrizzleUserRepository'
    )
    const { User } = await import('@/contexts/identity/domain/User')
    const { UserId } = await import('@/contexts/identity/domain/UserId')
    const { Email } = await import('@/contexts/identity/domain/Email')
    const repo = new DrizzleUserRepository(db)

    const user = must(User.invite(UserId.of('u1'), 'Alice', Email.fromTrusted('alice@example.com'), NOW))
    await repo.save(user)

    const found = await repo.findById(UserId.of('u1'))
    expect(found?.name).toBe('Alice')
    expect(found?.email.value).toBe('alice@example.com')
    expect(found?.role.value).toBe('user')
    expect(found?.kind).toBe('human')
    expect(found?.banned).toBe(false)

    expect((await repo.findByEmail(Email.fromTrusted('alice@example.com')))?.id.value).toBe('u1')
    expect(await repo.existsByEmail(Email.fromTrusted('alice@example.com'))).toBe(true)
    expect(await repo.existsByEmail(Email.fromTrusted('nobody@example.com'))).toBe(false)

    // rename + setStatus persist through the upsert.
    must(user.rename('Alice B', NOW))
    must(user.setStatus('inactive', NOW))
    await repo.save(user)
    const updated = await repo.findById(UserId.of('u1'))
    expect(updated?.name).toBe('Alice B')
    expect(updated?.banned).toBe(true)

    await repo.delete(UserId.of('u1'))
    expect(await repo.findById(UserId.of('u1'))).toBeNull()
  })

  it('DrizzleGetUsers batch-resolves refs and handles empty/unknown ids', async () => {
    const { DrizzleGetUsers } = await import('@/contexts/identity/adapters/out/persistence/DrizzleGetUsers')
    await seedUser(db, 'u1', { name: 'Alice', email: 'alice@example.com', role: 'admin' })
    await seedUser(db, 'u2', { name: 'Bob', email: 'bob@example.com' })
    const q = new DrizzleGetUsers(db)

    expect(await q.execute([])).toEqual([])
    const refs = await q.execute(['u1', 'u2', 'ghost'])
    expect(refs.map((r) => r.id).sort()).toEqual(['u1', 'u2'])
    expect(refs.find((r) => r.id === 'u1')?.role).toBe('admin')
    expect(refs.find((r) => r.id === 'u1')?.email).toBe('alice@example.com')
  })

  it('DrizzleFindUserByEmail resolves an id or null', async () => {
    const { DrizzleFindUserByEmail } = await import(
      '@/contexts/identity/adapters/out/persistence/DrizzleFindUserByEmail'
    )
    await seedUser(db, 'u1', { email: 'alice@example.com' })
    const q = new DrizzleFindUserByEmail(db)
    expect(await q.execute('alice@example.com')).toBe('u1')
    expect(await q.execute('nobody@example.com')).toBeNull()
  })

  it('DrizzleListUsers derives active/inactive status', async () => {
    const { DrizzleListUsers } = await import('@/contexts/identity/adapters/out/persistence/DrizzleListUsers')
    await seedUser(db, 'active1', { banned: false })
    await seedUser(db, 'banned1', { banned: true })
    const q = new DrizzleListUsers(db)
    const rows = await q.execute()
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get('active1')?.status).toBe('active')
    expect(byId.get('banned1')?.status).toBe('inactive')
    expect(byId.get('banned1')?.banned).toBe(true)
  })

  it('DrizzleListAssignableUsers excludes bots and banned users', async () => {
    const { DrizzleListAssignableUsers } = await import(
      '@/contexts/identity/adapters/out/persistence/DrizzleListAssignableUsers'
    )
    await seedUser(db, 'human', { kind: 'human', banned: false })
    await seedUser(db, 'bot', { kind: 'bot', banned: false })
    await seedUser(db, 'banned', { kind: 'human', banned: true })
    const q = new DrizzleListAssignableUsers(db)
    const ids = (await q.execute()).map((u) => u.id).sort()
    expect(ids).toEqual(['human'])
  })

  it('DrizzleLoginAttemptStore round-trips and deletes the sliding-window state', async () => {
    const { DrizzleLoginAttemptStore } = await import(
      '@/contexts/identity/adapters/out/persistence/DrizzleLoginAttemptStore'
    )
    const { LoginAttempt } = await import('@/contexts/identity/domain/LoginAttempt')
    const { Email } = await import('@/contexts/identity/domain/Email')
    const store = new DrizzleLoginAttemptStore(db)
    const email = Email.fromTrusted('user@example.com')

    const attempt = LoginAttempt.fresh(email)
    attempt.register(NOW)
    await store.save(attempt)

    const found = await store.find(email)
    expect(found?.attempts).toBe(1)
    expect(found?.lockedUntilRaw).toBeNull()

    // Five attempts inside the window arm the lock; the upsert keeps one row.
    const locked = LoginAttempt.fresh(email)
    for (let i = 0; i < 5; i++) locked.register(new Date(NOW.getTime() + i * 1000))
    await store.save(locked)
    const reloaded = await store.find(email)
    expect(reloaded?.attempts).toBe(5)
    expect(reloaded?.lockedUntilRaw).not.toBeNull()
    expect((await db.select().from(schema.loginAttempts)).length).toBe(1)

    await store.delete(email)
    expect(await store.find(email)).toBeNull()
  })
})

// ===========================================================================
// CREDENTIALS
// ===========================================================================

describeIntegration('credentials adapters', () => {
  let db: Database
  beforeAll(() => {
    db = getTestDb()
  })
  beforeEach(() => resetDb(db))

  const NOW = new Date('2026-06-30T12:00:00.000Z')
  const KEY = '0123456789abcdef0123456789abcdef' // 32 chars

  const makeRepo = async () => {
    const { DrizzleCredentialRepository } = await import(
      '@/contexts/credentials/adapters/out/persistence/DrizzleCredentialRepository'
    )
    const { AesCredentialCipher } = await import(
      '@/contexts/credentials/adapters/out/crypto/AesCredentialCipher'
    )
    const cipher = new AesCredentialCipher(KEY)
    return { repo: new DrizzleCredentialRepository(db, cipher), cipher }
  }

  const build = async (
    id: string,
    over: { pluginName?: string; type?: 'oauth2' | 'secret_text'; value?: Record<string, unknown>; isPrimary?: boolean; createdBy?: string | null } = {},
  ) => {
    const { Credential } = await import('@/contexts/credentials/domain/Credential')
    const { CredentialId } = await import('@/contexts/credentials/domain/ids')
    return must(
      Credential.create({
        id: CredentialId.of(id),
        name: `cred ${id}`,
        pluginName: over.pluginName ?? 'slack',
        type: over.type ?? 'secret_text',
        value: (over.value ?? { token: 's3cr3t' }) as never,
        isPrimary: over.isPrimary,
        createdBy: over.createdBy ?? 'u1',
        now: NOW,
      }),
    )
  }

  it('DrizzleCredentialRepository encrypts at rest and decrypts on read (round-trip)', async () => {
    const { repo, cipher } = await makeRepo()
    await seedUser(db, 'u1')
    const { CredentialId } = await import('@/contexts/credentials/domain/ids')

    const cred = await build('c1', { value: { token: 's3cr3t', n: 1 }, isPrimary: true })
    await repo.save(cred)

    const found = await repo.findById(CredentialId.of('c1'))
    expect(found?.name).toBe('cred c1')
    expect(found?.value).toEqual({ token: 's3cr3t', n: 1 })
    expect(found?.isPrimary).toBe(true)
    expect(found?.status).toBe('active')

    // Encryption boundary: the raw column is ciphertext, never the plaintext JSON.
    const [row] = await db.select().from(schema.credentials).where(eq(schema.credentials.id, 'c1'))
    expect(row?.value).not.toContain('s3cr3t')
    expect(row?.value).not.toBe(JSON.stringify({ token: 's3cr3t', n: 1 }))
    expect(JSON.parse(cipher.decrypt(row!.value))).toEqual({ token: 's3cr3t', n: 1 })

    expect(await repo.findById(CredentialId.of('missing'))).toBeNull()
  })

  it('DrizzleCredentialRepository upserts on save (update transition persists)', async () => {
    const { repo } = await makeRepo()
    await seedUser(db, 'u1')
    const { CredentialId } = await import('@/contexts/credentials/domain/ids')

    const cred = await build('c1', { value: { token: 'old' } })
    await repo.save(cred)
    must(cred.update({ value: { token: 'new' }, status: 'error', now: NOW }))
    await repo.save(cred)

    const found = await repo.findById(CredentialId.of('c1'))
    expect(found?.value).toEqual({ token: 'new' })
    expect(found?.status).toBe('error')
    expect((await db.select().from(schema.credentials)).length).toBe(1)
  })

  it('DrizzleCredentialRepository.findActiveCandidatesByPlugin orders primary-then-oldest', async () => {
    const { repo } = await makeRepo()
    await seedUser(db, 'u1')

    const { Credential } = await import('@/contexts/credentials/domain/Credential')
    const { CredentialId } = await import('@/contexts/credentials/domain/ids')
    const mk = (id: string, isPrimary: boolean, createdAt: Date) =>
      Credential.rehydrate({
        id: CredentialId.of(id),
        name: id,
        pluginName: 'slack',
        type: 'secret_text',
        status: 'active',
        isPrimary,
        value: { token: id },
        createdBy: 'u1',
        createdAt,
        updatedAt: createdAt,
      })

    await repo.save(mk('older', false, new Date('2026-01-01T00:00:00Z')))
    await repo.save(mk('newer', false, new Date('2026-02-01T00:00:00Z')))
    await repo.save(mk('primary', true, new Date('2026-03-01T00:00:00Z')))
    // an inactive one (must be excluded)
    const inactive = Credential.rehydrate({
      id: CredentialId.of('inactive'),
      name: 'inactive',
      pluginName: 'slack',
      type: 'secret_text',
      status: 'error',
      isPrimary: false,
      value: {},
      createdBy: 'u1',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    })
    await repo.save(inactive)

    const candidates = await repo.findActiveCandidatesByPlugin('slack')
    expect(candidates.map((c) => c.id)).toEqual(['primary', 'older', 'newer'])
  })

  it('DrizzleCredentialRepository.listOAuth2Ids + delete', async () => {
    const { repo } = await makeRepo()
    await seedUser(db, 'u1')
    const { CredentialId } = await import('@/contexts/credentials/domain/ids')

    await repo.save(await build('oauth', { type: 'oauth2', value: { access_token: 'x' } }))
    await repo.save(await build('secret', { type: 'secret_text' }))

    expect(await repo.listOAuth2Ids()).toEqual(['oauth'])

    await repo.delete(CredentialId.of('oauth'))
    expect(await repo.findById(CredentialId.of('oauth'))).toBeNull()
    expect(await repo.listOAuth2Ids()).toEqual([])
  })

  it('DrizzleListCredentials masks the secret value and filters by owner + plugin', async () => {
    const { DrizzleListCredentials } = await import(
      '@/contexts/credentials/adapters/out/persistence/DrizzleListCredentials'
    )
    await seedUser(db, 'u1')
    await seedUser(db, 'u2')
    // Raw inserts: the read adapter reads the raw `value` column (hasValue = !== '{}').
    await db.insert(schema.credentials).values([
      { id: 'empty', name: 'empty', pluginName: 'slack', type: 'secret_text', value: '{}', createdBy: 'u1' },
      { id: 'hasval', name: 'hasval', pluginName: 'slack', type: 'secret_text', value: 'ENC_BLOB', createdBy: 'u1' },
      { id: 'gh', name: 'gh', pluginName: 'github', type: 'secret_text', value: 'ENC2', createdBy: 'u1' },
      { id: 'others', name: 'others', pluginName: 'slack', type: 'secret_text', value: 'ENC3', createdBy: 'u2' },
    ])
    const list = new DrizzleListCredentials(db)

    const all = await list.execute({ userId: 'u1' })
    expect(all.map((c) => c.id).sort()).toEqual(['empty', 'gh', 'hasval'])
    // masking: no raw `value` leaks; only the hasValue flag.
    expect(all.every((c) => !('value' in c))).toBe(true)
    const byId = new Map(all.map((c) => [c.id, c]))
    expect(byId.get('empty')?.hasValue).toBe(false)
    expect(byId.get('hasval')?.hasValue).toBe(true)

    // pluginName filter (owner-scoped).
    const slack = await list.execute({ userId: 'u1', pluginName: 'slack' })
    expect(slack.map((c) => c.id).sort()).toEqual(['empty', 'hasval'])

    // owner scoping.
    const u2 = await list.execute({ userId: 'u2' })
    expect(u2.map((c) => c.id)).toEqual(['others'])
  })
})
