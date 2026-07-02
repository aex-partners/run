import { Json } from '@/shared/domain/Json'
import { GetPieceCatalog } from '@/contexts/plugins/application/ports/in/GetPieceCatalog'
import { PieceRegistry } from '@/contexts/plugins/application/ports/out/PieceRegistry'

// Read-side query. Source `plugins.catalog`: returns the bundled piece catalog
// verbatim. Reads the catalog through the registry out-port and surfaces each
// entry's raw JSON.
export class GetPieceCatalogService implements GetPieceCatalog {
  constructor(private readonly registry: PieceRegistry) {}

  async execute(): Promise<Json[]> {
    const entries = await this.registry.listCatalog()
    return entries.map((e) => e.raw)
  }
}
