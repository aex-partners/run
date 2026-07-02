// The install-lifecycle state of a plugin. Mirrors the `plugins.status` column
// enum. A plugin is born `available` (catalogued, not installed); `install`
// drives it `available -> installing -> installed` (or `-> error` on failure);
// enable/disable toggles `installed <-> disabled`; uninstall resets to `available`.
export type PluginStatus = 'available' | 'installed' | 'disabled' | 'installing' | 'error'
