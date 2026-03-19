import { eq } from "drizzle-orm";
import { plugins, customTools } from "../db/schema/index.js";
import type { Database } from "../db/index.js";
import type { PluginManifest, PluginMcpServerDef } from "./types.js";

interface McpConnection {
  pluginId: string;
  serverName: string;
  transport: PluginMcpServerDef["transport"];
  process?: ReturnType<typeof import("child_process").spawn> extends Promise<infer T> ? T : never;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any;
}

/**
 * Manages MCP server connections for installed plugins.
 * Handles lifecycle: start, stop, tool discovery, and tool execution.
 */
class McpManager {
  private connections = new Map<string, McpConnection>();

  private key(pluginId: string, serverName: string): string {
    return `${pluginId}:${serverName}`;
  }

  /**
   * Interpolate environment variables with plugin config values.
   */
  private interpolateEnv(
    env: Record<string, string>,
    config: Record<string, unknown>,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      result[key] = value.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
        const val = config[varName];
        return val !== undefined ? String(val) : "";
      });
    }
    return result;
  }

  /**
   * Start MCP servers for a plugin and discover their tools.
   */
  async startPlugin(
    db: Database,
    pluginId: string,
    userId: string,
  ): Promise<void> {
    const [plugin] = await db
      .select()
      .from(plugins)
      .where(eq(plugins.id, pluginId))
      .limit(1);

    if (!plugin) return;

    if (!plugin.manifest) return;
    const manifest: PluginManifest = JSON.parse(plugin.manifest);
    const config: Record<string, unknown> = JSON.parse(plugin.config);

    if (!manifest.mcpServers || manifest.mcpServers.length === 0) return;

    for (const serverDef of manifest.mcpServers) {
      const k = this.key(pluginId, serverDef.name);
      if (this.connections.has(k)) continue;

      try {
        const connection = await this.connectServer(serverDef, pluginId, config);
        this.connections.set(k, connection);

        // Discover tools from MCP server
        await this.discoverTools(db, pluginId, serverDef.name, userId);
      } catch (err) {
        console.error(`Failed to start MCP server ${k}:`, err);
      }
    }
  }

  /**
   * Stop all MCP servers for a plugin.
   */
  async stopPlugin(pluginId: string): Promise<void> {
    for (const [key, conn] of this.connections.entries()) {
      if (conn.pluginId === pluginId) {
        try {
          if (conn.process && "kill" in conn.process) {
            (conn.process as { kill: () => void }).kill();
          }
        } catch {
          // Ignore cleanup errors
        }
        this.connections.delete(key);
      }
    }
  }

  /**
   * Connect to an MCP server based on transport type.
   */
  private async connectServer(
    serverDef: PluginMcpServerDef,
    pluginId: string,
    config: Record<string, unknown>,
  ): Promise<McpConnection> {
    const envVars = serverDef.env
      ? this.interpolateEnv(serverDef.env, config)
      : {};

    const connection: McpConnection = {
      pluginId,
      serverName: serverDef.name,
      transport: serverDef.transport,
    };

    switch (serverDef.transport) {
      case "stdio": {
        if (!serverDef.command) {
          throw new Error(`MCP server ${serverDef.name} missing command for stdio transport`);
        }

        const { spawn } = await import("child_process");
        const proc = spawn(serverDef.command, serverDef.args ?? [], {
          env: { ...process.env, ...envVars },
          stdio: ["pipe", "pipe", "pipe"],
        });

        connection.process = proc as unknown as McpConnection["process"];
        break;
      }

      case "sse":
      case "streamable-http": {
        if (!serverDef.url) {
          throw new Error(`MCP server ${serverDef.name} missing url for ${serverDef.transport} transport`);
        }
        // HTTP-based transports store the URL for later use
        break;
      }
    }

    return connection;
  }

  /**
   * Discover tools from an MCP server and insert them as customTools.
   * This is a placeholder that will be fully implemented when @modelcontextprotocol/sdk is added.
   */
  private async discoverTools(
    db: Database,
    pluginId: string,
    serverName: string,
    userId: string,
  ): Promise<void> {
    const k = this.key(pluginId, serverName);
    const conn = this.connections.get(k);
    if (!conn) return;

    // When MCP SDK is integrated, this will call client.listTools()
    // and insert discovered tools as customTools with type = "mcp"
    // For now, tools declared in the manifest are already materialized during install
    console.log(`MCP server ${k} connected. Tool discovery via SDK pending.`);

    // Store server reference in tool config for routing
    const [plugin] = await db
      .select()
      .from(plugins)
      .where(eq(plugins.id, pluginId))
      .limit(1);

    if (!plugin) return;

    if (!plugin.manifest) return;
    const manifest: PluginManifest = JSON.parse(plugin.manifest);
    const mcpTools = manifest.tools?.filter((t) => t.type === "mcp") ?? [];

    for (const toolDef of mcpTools) {
      const toolName = `${pluginId}:${toolDef.name}`;
      const existing = await db
        .select()
        .from(customTools)
        .where(eq(customTools.name, toolName))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(customTools).values({
          id: crypto.randomUUID(),
          name: toolName,
          description: toolDef.description,
          inputSchema: JSON.stringify(toolDef.inputSchema),
          type: "mcp",
          config: JSON.stringify({
            ...toolDef.config,
            mcpServer: serverName,
            pluginId,
          }),
          isReadOnly: true,
          pluginId,
          createdBy: userId,
        });
      }
    }
  }

  /**
   * Call a tool on an MCP server.
   * Returns the tool result or throws on failure.
   */
  async callTool(
    pluginId: string,
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const k = this.key(pluginId, serverName);
    const conn = this.connections.get(k);

    if (!conn) {
      return { error: `MCP server ${k} not connected` };
    }

    // When MCP SDK is integrated, this will call client.callTool()
    // For now, return an error indicating SDK is not yet configured
    return {
      error: `MCP tool execution not yet available. Server: ${k}, Tool: ${toolName}`,
      args,
    };
  }

  /**
   * Reconnect all enabled plugin MCP servers. Called on API startup.
   */
  async reconnectAll(db: Database): Promise<void> {
    const installedPlugins = await db
      .select()
      .from(plugins)
      .where(eq(plugins.status, "installed"));

    for (const plugin of installedPlugins) {
      if (!plugin.manifest) return;
    const manifest: PluginManifest = JSON.parse(plugin.manifest);
      if (manifest.mcpServers && manifest.mcpServers.length > 0) {
        await this.startPlugin(db, plugin.id, plugin.installedBy ?? "system");
      }
    }
  }

  /**
   * Check if a server is connected.
   */
  isConnected(pluginId: string, serverName: string): boolean {
    return this.connections.has(this.key(pluginId, serverName));
  }
}

export const mcpManager = new McpManager();
