import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleGetConfigSchema } from '@/contexts/plugins/adapters/out/persistence/DrizzleGetConfigSchema'

const NOW = new Date('2024-01-01T00:00:00.000Z')

describeIntegration('DrizzleGetConfigSchema (integration)', () => {
  let db: Database
  let query: DrizzleGetConfigSchema

  beforeAll(() => {
    db = getTestDb()
    query = new DrizzleGetConfigSchema(db)
  })

  async function seedPlugin(manifest: string | null): Promise<string> {
    const id = `p-${randomUUID()}`
    await db.insert(schema.plugins).values({
      id,
      name: 'Gmail',
      version: '1.0.0',
      pieceName: `piece-gmail-${randomUUID()}`,
      source: 'piece',
      status: 'available',
      config: '{}',
      manifest,
      updatedAt: NOW,
    })
    return id
  }

  it('fails when the plugin id does not exist', async () => {
    const r = await query.execute({ id: `missing-${randomUUID()}` })
    expect(r.ok).toBe(false)
  })

  it("returns the manifest's configSchema when present", async () => {
    const configSchema = { type: 'object', properties: { apiKey: { type: 'string' } } }
    const id = await seedPlugin(JSON.stringify({ configSchema, tools: [] }))
    const r = await query.execute({ id })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual(configSchema)
  })

  it('returns null when there is no manifest', async () => {
    const id = await seedPlugin(null)
    const r = await query.execute({ id })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBeNull()
  })

  it('returns null when the manifest has no configSchema', async () => {
    const id = await seedPlugin(JSON.stringify({ tools: [] }))
    const r = await query.execute({ id })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBeNull()
  })

  it('returns null when the manifest is malformed JSON', async () => {
    const id = await seedPlugin('not-json')
    const r = await query.execute({ id })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBeNull()
  })
})
