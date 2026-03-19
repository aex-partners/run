/**
 * Plugin manifest and related types for the RUN plugin system.
 */

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  icon?: string;
  category: string;
  configSchema?: JsonSchema;
  tools?: PluginToolDef[];
  mcpServers?: PluginMcpServerDef[];
}

export interface PluginToolDef {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  type: "http" | "code" | "mcp";
  config: Record<string, unknown>;
}

export interface PluginMcpServerDef {
  name: string;
  transport: "stdio" | "sse" | "streamable-http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface PluginRow {
  id: string;
  name: string;
  description: string | null;
  version: string;
  author: string | null;
  icon: string | null;
  category: string | null;
  manifest: string;
  source: "registry" | "local" | "git";
  sourceUrl: string | null;
  status: "available" | "installed" | "disabled";
  config: string;
  installedAt: Date | null;
  installedBy: string | null;
  updatedAt: Date;
}

// Minimal JSON Schema subset used for config schemas and tool input schemas
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: JsonSchema;
  [key: string]: unknown;
}
