import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleGetSkill } from '@/contexts/skills/adapters/out/persistence/DrizzleGetSkill'

describeIntegration('DrizzleGetSkill (integration)', () => {
  let db: Database
  let getSkill: DrizzleGetSkill
  beforeAll(() => {
    db = getTestDb()
    getSkill = new DrizzleGetSkill(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  it('projects a stored row into a SkillView with parsed columns', async () => {
    const createdBy = await seedUser()
    const id = `s-${randomUUID()}`
    const slug = `skill_${randomUUID().replace(/-/g, '_')}`
    await db.insert(schema.skills).values({
      id,
      name: 'Viewer',
      slug,
      description: 'Look.',
      systemPrompt: 'View it.',
      toolIds: JSON.stringify(['query']),
      systemToolNames: JSON.stringify([]),
      guardrails: JSON.stringify({ maxSteps: 2 }),
      createdBy,
    })

    const view = await getSkill.execute({ id })
    expect(view).not.toBeNull()
    expect(view?.id).toBe(id)
    expect(view?.name).toBe('Viewer')
    expect(view?.slug).toBe(slug)
    expect(view?.description).toBe('Look.')
    expect(view?.systemPrompt).toBe('View it.')
    expect(view?.toolIds).toEqual(['query'])
    expect(view?.systemToolNames).toEqual([])
    expect(view?.guardrails).toEqual({ maxSteps: 2 })
    expect(view?.createdBy).toBe(createdBy)
    expect(view?.createdAt).toBeInstanceOf(Date)
  })

  it('returns null when the skill does not exist', async () => {
    expect(await getSkill.execute({ id: `missing-${randomUUID()}` })).toBeNull()
  })
})
