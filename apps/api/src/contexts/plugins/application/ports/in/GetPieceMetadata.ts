import { PieceMetadata } from '@/contexts/plugins/domain/PieceMetadata'

// In-port: the flow builder asks for a piece's actions + input properties so it
// can render the action form. Backed by the remote catalog (no local install).
export interface GetPieceMetadataQuery {
  pieceName: string
}

export interface GetPieceMetadata {
  execute(query: GetPieceMetadataQuery): Promise<PieceMetadata | null>
}
