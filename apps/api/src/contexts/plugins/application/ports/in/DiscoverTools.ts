import { PieceToolDescriptor } from '@/contexts/plugins/domain/PieceToolset'

// Driving port consumed by OTHER contexts (assistant / automation) via an ACL in
// main. Source `ai/piece-tools.ts` (buildPieceTools): for every INSTALLED piece,
// load it and project each action into a tool descriptor (sanitized+deduped name,
// JSON-Schema input, read-only classification, real piece/action identifiers).
// The assistant turns these into MCP tools whose handler calls ResolvePieceAction.
export interface DiscoverTools {
  execute(): Promise<PieceToolDescriptor[]>
}
