import { Json } from '@/shared/domain/Json'
import { Result } from '@/shared/kernel/Result'

// Read side. Source `plugins.getConfigSchema`: parses the plugin's manifest JSON
// and returns its `configSchema` (or null when there is no manifest/schema).
// Fails when the plugin id does not exist (source throws NOT_FOUND).
export interface GetConfigSchemaQuery {
  id: string
}

export interface GetConfigSchema {
  execute(query: GetConfigSchemaQuery): Promise<Result<Json | null>>
}
