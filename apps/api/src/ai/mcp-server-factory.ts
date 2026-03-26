import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { buildAllSystemTools } from "./system-tools/index.js";
import type { AgentConfig, ToolContext } from "./types.js";

export function buildMcpServer(opts: {
  agentConfig: AgentConfig;
  toolContext: ToolContext;
}) {
  const tools = buildAllSystemTools(opts.toolContext);

  return createSdkMcpServer({
    name: "aex",
    version: "1.0.0",
    tools,
  });
}
