// Driven port for the runtime piece-package installer (source
// `piece-installer.ts`: `npm install/uninstall @activepieces/piece-*` into a
// dedicated `.pieces/` dir). The install lifecycle's only IO dependency; the
// adapter (adapters/out/installer) owns the child-process / filesystem work.
export interface PieceInstaller {
  install(pieceName: string): Promise<void>
  uninstall(pieceName: string): Promise<void>
}
