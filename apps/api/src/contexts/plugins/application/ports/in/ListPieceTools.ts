// Read side. Source `plugins.listPieceTools`: the per-action tool list the UI
// shows for INSTALLED plugins. Lighter than DiscoverTools (no input schema /
// invocation identifiers) — just display metadata.
export interface PieceToolView {
  name: string
  displayName: string
  description: string
  pluginName: string
  pluginDisplayName: string
  pluginLogoUrl: string | null
}

export interface ListPieceTools {
  execute(): Promise<PieceToolView[]>
}
