import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleAgentRepository } from '@/contexts/agents/adapters/out/persistence/DrizzleAgentRepository'
import { Agent } from '@/contexts/agents/domain/Agent'
import { AgentId } from '@/contexts/agents/domain/AgentId'
import { AgentSlug } from '@/contexts/agents/domain/AgentSlug'

const NOW = new Date('2024-01-01T00:00:00.000Z')

describeIntegration('DrizzleAgentRepository (integration)', () => {
  let db: Database
  let repo: DrizzleAgentRepository
  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzleAgentRepository(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  function makeAgent(createdBy: string | null, overrides: Partial<{ name: string; skillIds: string[]; toolIds: string[] }> = {}): Agent {
    const id = AgentId.of(`a-${randomUUID()}`)
    const name = overrides.name ?? 'Sales Bot'
    const res = Agent.create({
      id,
      name,
      slug: AgentSlug.of(`agent_${randomUUID().replace(/-/g, '_')}`),
      systemPrompt: 'Close deals.',
      skillIds: overrides.skillIds ?? ['skill-a'],
      toolIds: overrides.toolIds ?? ['query'],
      createdBy,
      now: NOW,
    })
    if (!res.ok) throw new Error(res.error)
    return res.value
  }

  it('nextId returns a fresh AgentId', () => {
    const a = repo.nextId()
    const b = repo.nextId()
    expect(a.value).not.toBe(b.value)
  })

  it('round-trips an aggregate through save/findById', async () => {
    const createdBy = await seedUser()
    const agent = makeAgent(createdBy)
    await repo.save(agent)

    const found = await repo.findById(agent.id)
    expect(found).not.toBeNull()
    expect(found?.id.value).toBe(agent.id.value)
    expect(found?.name).toBe('Sales Bot')
    expect(found?.slug.value).toBe(agent.slug.value)
    expect(found?.systemPrompt).toBe('Close deals.')
    expect([...(found?.skillIds ?? [])]).toEqual(['skill-a'])
    expect([...(found?.toolIds ?? [])]).toEqual(['query'])
    expect(found?.isSystem).toBe(false)
    expect(found?.createdBy).toBe(createdBy)
    expect(found?.userId).toBeNull()
  })

  it('persists a linked bot user', async () => {
    const createdBy = await seedUser()
    const botUser = await seedUser()
    const agent = makeAgent(createdBy)
    agent.linkBotUser(botUser)
    await repo.save(agent)

    const found = await repo.findById(agent.id)
    expect(found?.userId).toBe(botUser)
  })

  it('returns null for an unknown id', async () => {
    const found = await repo.findById(AgentId.of(`missing-${randomUUID()}`))
    expect(found).toBeNull()
  })

  it('save upserts on conflicting id (create then edit)', async () => {
    const createdBy = await seedUser()
    const agent = makeAgent(createdBy)
    await repo.save(agent)

    const upd = agent.update({ name: 'Renamed Bot', systemPrompt: 'New prompt.', toolIds: ['query', 'web_search'] }, NOW)
    expect(upd.ok).toBe(true)
    await repo.save(agent)

    const found = await repo.findById(agent.id)
    expect(found?.name).toBe('Renamed Bot')
    expect(found?.systemPrompt).toBe('New prompt.')
    expect([...(found?.toolIds ?? [])]).toEqual(['query', 'web_search'])
  })

  it('existsBySlug honours the optional exception id', async () => {
    const createdBy = await seedUser()
    const agent = makeAgent(createdBy)
    await repo.save(agent)

    expect(await repo.existsBySlug(agent.slug)).toBe(true)
    expect(await repo.existsBySlug(AgentSlug.of(`nope-${randomUUID()}`))).toBe(false)
    // Excepting the owning agent itself -> not a collision.
    expect(await repo.existsBySlug(agent.slug, agent.id)).toBe(false)
    // Excepting a different id -> still a collision.
    expect(await repo.existsBySlug(agent.slug, AgentId.of(`other-${randomUUID()}`))).toBe(true)
  })

  it('deletes an agent', async () => {
    const createdBy = await seedUser()
    const agent = makeAgent(createdBy)
    await repo.save(agent)
    expect(await repo.findById(agent.id)).not.toBeNull()

    await repo.delete(agent.id)
    expect(await repo.findById(agent.id)).toBeNull()
  })
})
