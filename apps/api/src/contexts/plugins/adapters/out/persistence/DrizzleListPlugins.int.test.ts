import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleListPlugins } from '@/contexts/plugins/adapters/out/persistence/DrizzleListPlugins'

const NOW = new Date('2024-01-01T00:00:00.000Z')

describeIntegration('DrizzleListPlugins (integration)', () => {
  let db: Database
  let query: DrizzleListPlugins

  beforeAll(() => {
    db = getTestDb()
    query = new DrizzleListPlugins(db)
  })

  it('projects each row to the UI view with parsed config', async () => {
    const id = `p-${randomUUID()}`
    await db.insert(schema.plugins).values({
      id,
      name: 'Slack',
      version: '2.0.0',
      pieceName: `piece-slack-${randomUUID()}`,
      source: 'piece',
      status: 'available',
      config: JSON.stringify({ webhook: 'https://x' }),
      updatedAt: NOW,
    })

    const rows = await query.execute()
    const mine = rows.find((r) => r.id === id)
    expect(mine).toBeDefined()
    expect(mine!.name).toBe('Slack')
    expect(mine!.status).toBe('available')
    expect(mine!.config).toEqual({ webhook: 'https://x' })
  })

  it('defaults a malformed config column to {}', async () => {
    const id = `p-${randomUUID()}`
    await db.insert(schema.plugins).values({
      id,
      name: 'Broken',
      version: '1.0.0',
      source: 'registry',
      status: 'available',
      config: 'not-json',
      updatedAt: NOW,
    })

    const rows = await query.execute()
    const mine = rows.find((r) => r.id === id)
    expect(mine!.config).toEqual({})
  })
})
