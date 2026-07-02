// Scope of a plugin-store KV entry. `project` is process/installation-wide;
// `flow` is keyed to one flow so two flows sharing a piece trigger keep
// independent cursors / webhook ids / dedupe sets. Mirrors `plugin_store.scope`.
export type PluginStoreScope = 'project' | 'flow'
