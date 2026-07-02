import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleListSkills } from '@/contexts/skills/adapters/out/persistence/DrizzleListSkills'

describeIntegration('DrizzleListSkills (integration)', () => {
  let db: Database
  let listSkills: DrizzleListSkills
  beforeAll(() => {
    db = getTestDb()
    listSkills = new DrizzleListSkills(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  it('lists the skills it created, projected into views', async () => {
    const createdBy = await seedUser()
    const id1 = `s-${randomUUID()}`
    const id2 = `s-${randomUUID()}`
    await db.insert(schema.skills).values([
      {
        id: id1,
        name: 'One',
        slug: `skill_${randomUUID().replace(/-/g, '_')}`,
        systemPrompt: '1.',
        toolIds: JSON.stringify(['query']),
        guardrails: JSON.stringify({ maxSteps: 1 }),
        createdBy,
      },
      {
        id: id2,
        name: 'Two',
        slug: `skill_${randomUUID().replace(/-/g, '_')}`,
        systemPrompt: '2.',
        toolIds: JSON.stringify([]),
        guardrails: JSON.stringify({}),
        createdBy,
      },
    ])

    const all = await listSkills.execute()
    const mine = all.filter((s) => s.id === id1 || s.id === id2)
    expect(mine).toHaveLength(2)

    const one = mine.find((s) => s.id === id1)
    expect(one?.name).toBe('One')
    expect(one?.toolIds).toEqual(['query'])
    expect(one?.guardrails).toEqual({ maxSteps: 1 })
    const two = mine.find((s) => s.id === id2)
    expect(two?.name).toBe('Two')
    expect(two?.guardrails).toEqual({})
  })
})
