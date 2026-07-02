import { PluginView } from '@/contexts/plugins/application/ports/in/ListPlugins'

// Driving (read) port for `plugins.getById`. Returns null when no row matches.
export interface GetPluginQuery {
  id: string
}

export interface GetPlugin {
  execute(query: GetPluginQuery): Promise<PluginView | null>
}
