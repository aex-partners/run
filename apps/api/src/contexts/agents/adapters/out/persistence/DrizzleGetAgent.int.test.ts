import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleGetAgent } from '@/contexts/agents/adapters/out/persistence/DrizzleGetAgent'

describeIntegration('DrizzleGetAgent (integration)', () => {
  let db: Database
  let getAgent: DrizzleGetAgent
  beforeAll(() => {
    db = getTestDb()
    getAgent = new DrizzleGetAgent(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  it('projects a stored row into an AgentView with parsed id lists', async () => {
    const createdBy = await seedUser()
    const id = `a-${randomUUID()}`
    const slug = `agent_${randomUUID().replace(/-/g, '_')}`
    await db.insert(schema.agents).values({
      id,
      name: 'Reader',
      slug,
      systemPrompt: 'Read things.',
      skillIds: JSON.stringify(['s1', 's2']),
      toolIds: JSON.stringify(['query']),
      createdBy,
    })

    const view = await getAgent.execute({ id })
    expect(view).not.toBeNull()
    expect(view?.id).toBe(id)
    expect(view?.name).toBe('Reader')
    expect(view?.slug).toBe(slug)
    expect(view?.systemPrompt).toBe('Read things.')
    expect(view?.skillIds).toEqual(['s1', 's2'])
    expect(view?.toolIds).toEqual(['query'])
    expect(view?.isSystem).toBe(false)
    expect(view?.createdBy).toBe(createdBy)
    expect(view?.createdAt).toBeInstanceOf(Date)
  })

  it('returns null when the agent does not exist', async () => {
    const view = await getAgent.execute({ id: `missing-${randomUUID()}` })
    expect(view).toBeNull()
  })
})
