import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleLookupAgents } from '@/contexts/agents/adapters/out/persistence/DrizzleLookupAgents'

describeIntegration('DrizzleLookupAgents (integration)', () => {
  let db: Database
  let lookup: DrizzleLookupAgents
  beforeAll(() => {
    db = getTestDb()
    lookup = new DrizzleLookupAgents(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  async function seedAgent(createdBy: string): Promise<{ id: string; slug: string; name: string }> {
    const id = `a-${randomUUID()}`
    const slug = `agent_${randomUUID().replace(/-/g, '_')}`
    const name = `Agent ${randomUUID().slice(0, 6)}`
    await db.insert(schema.agents).values({ id, name, slug, systemPrompt: 'x', createdBy })
    return { id, slug, name }
  }

  it('byIds returns the minimal refs for the requested ids', async () => {
    const createdBy = await seedUser()
    const a1 = await seedAgent(createdBy)
    const a2 = await seedAgent(createdBy)

    const refs = await lookup.byIds([a1.id, a2.id])
    expect(refs).toHaveLength(2)
    expect(refs.find((r) => r.id === a1.id)).toEqual({ id: a1.id, name: a1.name, slug: a1.slug })
    expect(refs.find((r) => r.id === a2.id)).toEqual({ id: a2.id, name: a2.name, slug: a2.slug })
  })

  it('byIds returns [] for an empty list', async () => {
    expect(await lookup.byIds([])).toEqual([])
  })

  it('bySlug resolves a single ref and yields null for an unknown slug', async () => {
    const createdBy = await seedUser()
    const a = await seedAgent(createdBy)

    expect(await lookup.bySlug(a.slug)).toEqual({ id: a.id, name: a.name, slug: a.slug })
    expect(await lookup.bySlug(`unknown-${randomUUID()}`)).toBeNull()
  })
})
