import { PieceMetadata } from '@/contexts/plugins/domain/PieceMetadata'

// Out-port: fetch a piece's full metadata (actions/triggers + their input
// properties) from a remote registry, WITHOUT the piece being installed on disk.
// Lets the flow builder render a piece's action form before install; install is
// only needed to actually run the piece.
export interface RemotePieceCatalog {
  getMetadata(pieceName: string): Promise<PieceMetadata | null>
}
