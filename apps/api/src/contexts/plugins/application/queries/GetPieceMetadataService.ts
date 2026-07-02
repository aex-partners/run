import { GetPieceMetadata, GetPieceMetadataQuery } from '@/contexts/plugins/application/ports/in/GetPieceMetadata'
import { RemotePieceCatalog } from '@/contexts/plugins/application/ports/out/RemotePieceCatalog'
import { PieceMetadata } from '@/contexts/plugins/domain/PieceMetadata'

// Read-side query. Delegates to the remote catalog so the builder can load a
// piece's action form without the piece being installed.
export class GetPieceMetadataService implements GetPieceMetadata {
  constructor(private readonly remote: RemotePieceCatalog) {}

  execute(query: GetPieceMetadataQuery): Promise<PieceMetadata | null> {
    return this.remote.getMetadata(query.pieceName)
  }
}
