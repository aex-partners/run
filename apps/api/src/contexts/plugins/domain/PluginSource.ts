// Where a plugin originates. `registry` is the bundled piece catalog, `piece` an
// ActivePieces npm package, `local` a filesystem piece, `git` a remote repo.
// Mirrors the `plugins.source` column enum.
export type PluginSource = 'registry' | 'local' | 'git' | 'piece'
