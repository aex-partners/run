import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleListAgents } from '@/contexts/agents/adapters/out/persistence/DrizzleListAgents'

describeIntegration('DrizzleListAgents (integration)', () => {
  let db: Database
  let listAgents: DrizzleListAgents
  beforeAll(() => {
    db = getTestDb()
    listAgents = new DrizzleListAgents(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  it('lists the agents it created, projected into views', async () => {
    const createdBy = await seedUser()
    const id1 = `a-${randomUUID()}`
    const id2 = `a-${randomUUID()}`
    await db.insert(schema.agents).values([
      {
        id: id1,
        name: 'Alpha',
        slug: `agent_${randomUUID().replace(/-/g, '_')}`,
        systemPrompt: 'A.',
        toolIds: JSON.stringify(['query']),
        createdBy,
      },
      {
        id: id2,
        name: 'Beta',
        slug: `agent_${randomUUID().replace(/-/g, '_')}`,
        systemPrompt: 'B.',
        toolIds: JSON.stringify([]),
        createdBy,
      },
    ])

    const all = await listAgents.execute()
    const mine = all.filter((a) => a.id === id1 || a.id === id2)
    expect(mine).toHaveLength(2)

    const alpha = mine.find((a) => a.id === id1)
    expect(alpha?.name).toBe('Alpha')
    expect(alpha?.toolIds).toEqual(['query'])
    const beta = mine.find((a) => a.id === id2)
    expect(beta?.name).toBe('Beta')
    expect(beta?.toolIds).toEqual([])
  })
})
