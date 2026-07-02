import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleGetPlugin } from '@/contexts/plugins/adapters/out/persistence/DrizzleGetPlugin'

const NOW = new Date('2024-01-01T00:00:00.000Z')

describeIntegration('DrizzleGetPlugin (integration)', () => {
  let db: Database
  let query: DrizzleGetPlugin

  beforeAll(() => {
    db = getTestDb()
    query = new DrizzleGetPlugin(db)
  })

  it('returns the row as a view with parsed config', async () => {
    const id = `p-${randomUUID()}`
    await db.insert(schema.plugins).values({
      id,
      name: 'Gmail',
      version: '1.0.0',
      pieceName: `piece-gmail-${randomUUID()}`,
      source: 'piece',
      status: 'installed',
      config: JSON.stringify({ apiKey: 'k' }),
      updatedAt: NOW,
    })

    const view = await query.execute({ id })
    expect(view).not.toBeNull()
    expect(view!.id).toBe(id)
    expect(view!.name).toBe('Gmail')
    expect(view!.status).toBe('installed')
    expect(view!.config).toEqual({ apiKey: 'k' })
  })

  it('returns null when no row matches', async () => {
    expect(await query.execute({ id: `missing-${randomUUID()}` })).toBeNull()
  })
})
