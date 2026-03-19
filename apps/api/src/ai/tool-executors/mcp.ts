/**
 * MCP tool executor: delegates tool calls to MCP servers via the McpManager.
 */
import { mcpManager } from "../../plugins/mcp-manager.js";

export async function executeMcp(
  args: Record<string, unknown>,
  config: Record<string, unknown>,
): Promise<unknown> {
  const pluginId = config.pluginId as string;
  const mcpServer = config.mcpServer as string;
  const toolName = config.toolName as string;

  if (!pluginId || !mcpServer) {
    return { error: "MCP tool missing pluginId or mcpServer in config" };
  }

  return mcpManager.callTool(pluginId, mcpServer, toolName, args);
}
