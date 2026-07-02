import { Json } from '@/shared/domain/Json'

// Read side. The bundled piece catalog as the UI consumes it (source
// `plugins.catalog`). Each entry describes an installable piece; shape is the
// catalog JSON, surfaced as opaque Json so the registry owns the schema.
export interface GetPieceCatalog {
  execute(): Promise<Json[]>
}
