import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { plugins } from '@/platform/db/schema'
import { Json } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { GetConfigSchema, GetConfigSchemaQuery } from '@/contexts/plugins/application/ports/in/GetConfigSchema'

// Driven read-side adapter (CQRS). Answers `plugins.getConfigSchema`: load the
// row (fail when missing, mirroring the source NOT_FOUND), parse its manifest JSON
// and return `manifest.configSchema` (or null when there is no manifest/schema).
export class DrizzleGetConfigSchema implements GetConfigSchema {
  constructor(private readonly db: Database) {}

  async execute(query: GetConfigSchemaQuery): Promise<Result<Json | null>> {
    const [row] = await this.db.select().from(plugins).where(eq(plugins.id, query.id)).limit(1)
    if (!row) return fail(`Plugin not found: ${query.id}`)
    if (!row.manifest) return ok(null)

    try {
      const manifest: unknown = JSON.parse(row.manifest)
      if (typeof manifest === 'object' && manifest !== null && 'configSchema' in manifest) {
        return ok((manifest as { configSchema: Json }).configSchema ?? null)
      }
      return ok(null)
    } catch {
      return ok(null)
    }
  }
}
