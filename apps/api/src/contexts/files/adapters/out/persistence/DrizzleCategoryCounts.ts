import { sql } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { CategoryCounts, CategoryCountsResult } from '@/contexts/files/application/queries/CategoryCounts'

// Read-side adapter (CQRS). One FILTER aggregate over the files table, ported
// 1:1 from `files.categoryCounts`.
export class DrizzleCategoryCounts implements CategoryCounts {
  constructor(private readonly db: Database) {}

  async execute(input: { ownerId: string }): Promise<CategoryCountsResult> {
    const rows = await this.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL) as "all",
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND starred = 1) as starred,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND updated_at >= NOW() - INTERVAL '7 days') as recent,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND (
          public_token IS NOT NULL
          OR EXISTS (SELECT 1 FROM file_shares WHERE file_shares.file_id = files.id)
        )) as shared,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as trash
      FROM files
      WHERE owner_id = ${input.ownerId}
    `)

    const r = (rows as unknown as Array<Record<string, unknown>>)[0]
    return {
      all: Number(r?.all) || 0,
      starred: Number(r?.starred) || 0,
      recent: Number(r?.recent) || 0,
      shared: Number(r?.shared) || 0,
      trash: Number(r?.trash) || 0,
    }
  }
}
