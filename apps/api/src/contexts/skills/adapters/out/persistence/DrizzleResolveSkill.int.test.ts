import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleResolveSkill } from '@/contexts/skills/adapters/out/persistence/DrizzleResolveSkill'

describeIntegration('DrizzleResolveSkill (integration)', () => {
  let db: Database
  let resolve: DrizzleResolveSkill
  beforeAll(() => {
    db = getTestDb()
    resolve = new DrizzleResolveSkill(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  it('resolves a stored skill into the assistant-facing config', async () => {
    const createdBy = await seedUser()
    const id = `s-${randomUUID()}`
    const slug = `skill_${randomUUID().replace(/-/g, '_')}`
    await db.insert(schema.skills).values({
      id,
      name: 'Resolver',
      slug,
      systemPrompt: 'Resolve it.',
      toolIds: JSON.stringify(['query', 'web_search']),
      systemToolNames: JSON.stringify(['Read', 'Grep']),
      guardrails: JSON.stringify({ maxSteps: 5, requireConfirmation: false }),
      createdBy,
    })

    const res = await resolve.execute({ skillId: id })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).not.toBeNull()
    expect(res.value).toEqual({
      id,
      slug,
      name: 'Resolver',
      systemPrompt: 'Resolve it.',
      toolIds: ['query', 'web_search'],
      systemToolNames: ['Read', 'Grep'],
      guardrails: { maxSteps: 5, requireConfirmation: false },
    })
  })

  it('returns ok(null) when the skill no longer exists', async () => {
    const res = await resolve.execute({ skillId: `missing-${randomUUID()}` })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toBeNull()
  })
})
