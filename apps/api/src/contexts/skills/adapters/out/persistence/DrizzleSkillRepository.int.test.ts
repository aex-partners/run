import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleSkillRepository } from '@/contexts/skills/adapters/out/persistence/DrizzleSkillRepository'
import { Skill } from '@/contexts/skills/domain/Skill'
import { SkillId } from '@/contexts/skills/domain/ids'
import { Guardrails } from '@/contexts/skills/domain/Guardrails'

const NOW = new Date('2024-01-01T00:00:00.000Z')

describeIntegration('DrizzleSkillRepository (integration)', () => {
  let db: Database
  let repo: DrizzleSkillRepository
  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzleSkillRepository(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  function guardrails(): Guardrails {
    const res = Guardrails.of({ maxSteps: 3, blockedTools: ['delete_record'], requireConfirmation: true })
    if (!res.ok) throw new Error(res.error)
    return res.value
  }

  function makeSkill(createdBy: string): Skill {
    const res = Skill.create({
      id: SkillId.of(`s-${randomUUID()}`),
      name: `Skill ${randomUUID()}`,
      description: 'A skill.',
      systemPrompt: 'Do the thing.',
      toolIds: ['query', 'web_search'],
      systemToolNames: ['Read'],
      guardrails: guardrails(),
      createdBy,
      now: NOW,
    })
    if (!res.ok) throw new Error(res.error)
    return res.value
  }

  it('nextId returns a fresh SkillId', () => {
    expect(repo.nextId().value).not.toBe(repo.nextId().value)
  })

  it('round-trips an aggregate through save/findById', async () => {
    const createdBy = await seedUser()
    const skill = makeSkill(createdBy)
    await repo.save(skill)

    const found = await repo.findById(skill.id)
    expect(found).not.toBeNull()
    expect(found?.id.value).toBe(skill.id.value)
    expect(found?.name).toBe(skill.name)
    expect(found?.slug).toBe(skill.slug)
    expect(found?.systemPrompt).toBe('Do the thing.')
    expect([...(found?.toolIds ?? [])]).toEqual(['query', 'web_search'])
    expect([...(found?.systemToolNames ?? [])]).toEqual(['Read'])
    expect(found?.guardrails.toValue()).toEqual({
      maxSteps: 3,
      blockedTools: ['delete_record'],
      requireConfirmation: true,
    })
    expect(found?.createdBy).toBe(createdBy)
  })

  it('returns null for an unknown id', async () => {
    expect(await repo.findById(SkillId.of(`missing-${randomUUID()}`))).toBeNull()
  })

  it('save upserts on conflicting id (create then edit)', async () => {
    const createdBy = await seedUser()
    const skill = makeSkill(createdBy)
    await repo.save(skill)

    const upd = skill.update({ systemPrompt: 'Updated prompt.', toolIds: ['query'] }, NOW)
    expect(upd.ok).toBe(true)
    await repo.save(skill)

    const found = await repo.findById(skill.id)
    expect(found?.systemPrompt).toBe('Updated prompt.')
    expect([...(found?.toolIds ?? [])]).toEqual(['query'])
  })

  it('existsBySlug honours the optional excludeId', async () => {
    const createdBy = await seedUser()
    const skill = makeSkill(createdBy)
    await repo.save(skill)

    expect(await repo.existsBySlug(skill.slug)).toBe(true)
    expect(await repo.existsBySlug(`nope-${randomUUID()}`)).toBe(false)
    expect(await repo.existsBySlug(skill.slug, skill.id.value)).toBe(false)
    expect(await repo.existsBySlug(skill.slug, `other-${randomUUID()}`)).toBe(true)
  })

  it('deletes a skill', async () => {
    const createdBy = await seedUser()
    const skill = makeSkill(createdBy)
    await repo.save(skill)
    expect(await repo.findById(skill.id)).not.toBeNull()

    await repo.delete(skill.id)
    expect(await repo.findById(skill.id)).toBeNull()
  })
})
