import { tool } from "ai";
import { eq, inArray } from "drizzle-orm";
import { jsonSchemaToZod } from "./json-schema-to-zod.js";
import { createTools, type ToolContext } from "./tools.js";
import { customTools, skills, agents, plugins } from "../db/schema/index.js";
import type { Database } from "../db/index.js";
import { loadPiece } from "../plugins/piece-loader.js";
import { pieceActionsToTools } from "../plugins/piece-to-tool.js";
import { getCredentialForPlugin } from "../credentials/credential-service.js";

// Use `any` for tool types to avoid AI SDK generic constraints
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AiTool = any;

interface CustomToolRow {
  id: string;
  name: string;
  description: string;
  inputSchema: string;
  outputSchema: string | null;
  type: string;
  config: string;
  isReadOnly: boolean;
  integrationId: string | null;
  pluginId: string | null;
}

interface SkillRow {
  id: string;
  name: string;
  systemPrompt: string;
  toolIds: string;
  systemToolNames: string;
  guardrails: string;
}

/**
 * Build an AI SDK tool from a custom_tools DB row.
 * pluginConfig is the parent plugin's config (from plugins.config column),
 * merged into tool args so template variables like {{token}} resolve correctly.
 */
export function buildCustomTool(
  row: CustomToolRow,
  ctx: ToolContext,
  pluginConfig?: Record<string, unknown>,
): AiTool {
  const inputSchema = jsonSchemaToZod(JSON.parse(row.inputSchema));
  const config = JSON.parse(row.config) as Record<string, unknown>;

  // Only allow args declared in inputSchema to prevent credential override
  const declaredKeys = new Set(
    Object.keys((JSON.parse(row.inputSchema) as { properties?: Record<string, unknown> }).properties ?? {}),
  );

  return tool({
    description: row.description,
    inputSchema,
    execute: async (args) => {
      const raw = args as Record<string, unknown>;
      const filtered: Record<string, unknown> = {};
      for (const key of Object.keys(raw)) {
        if (declaredKeys.has(key)) filtered[key] = raw[key];
      }
      const a = { ...filtered, ...pluginConfig };
      switch (row.type) {
        case "http":
          return executeHttpTool(a, config);
        case "query":
          return executeQueryTool(a, config, ctx);
        case "code":
          return executeCodeTool(a, config);
        case "composite":
          return executeCompositeTool(a, config, ctx);
        case "mcp":
          return executeMcpTool(a, config);
        default:
          return { error: `Unknown tool type: ${row.type}` };
      }
    },
  });
}

/**
 * Load all custom tools from DB and build AI SDK tools.
 * Filters out tools belonging to disabled integrations.
 */
export async function loadCustomTools(
  db: Database,
  ctx: ToolContext,
  toolIds?: string[],
): Promise<Record<string, AiTool>> {
  const result: Record<string, AiTool> = {};

  let rows: CustomToolRow[];
  if (toolIds && toolIds.length > 0) {
    rows = await db.select().from(customTools).where(inArray(customTools.id, toolIds));
  } else if (toolIds) {
    return result;
  } else {
    rows = await db.select().from(customTools);
  }

  // Load disabled integrations to filter out their tools
  const { integrations } = await import("../db/schema/index.js");
  const disabledIntegrations = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(eq(integrations.status, "disabled" as const));
  const disabledIds = new Set(disabledIntegrations.map((i) => i.id));

  // Load disabled plugins and their configs
  const allPlugins = await db
    .select({ id: plugins.id, status: plugins.status, config: plugins.config })
    .from(plugins);
  const disabledPluginIds = new Set(
    allPlugins.filter((p) => p.status === "disabled").map((p) => p.id),
  );
  const pluginConfigMap = new Map<string, Record<string, unknown>>();
  for (const p of allPlugins) {
    if (p.config) {
      try {
        pluginConfigMap.set(p.id, JSON.parse(p.config) as Record<string, unknown>);
      } catch {
        // ignore invalid JSON
      }
    }
  }

  for (const row of rows) {
    // Skip tools from disabled integrations
    if (row.integrationId && disabledIds.has(row.integrationId)) {
      continue;
    }

    // Skip tools from disabled plugins
    if (row.pluginId && disabledPluginIds.has(row.pluginId)) {
      continue;
    }

    try {
      const pluginCfg = row.pluginId ? pluginConfigMap.get(row.pluginId) : undefined;
      result[row.name] = buildCustomTool(row, ctx, pluginCfg);
    } catch (err) {
      console.error(`Failed to build custom tool "${row.name}":`, err);
    }
  }

  return result;
}

/**
 * Resolve tools for a skill: custom tools by ID + system tools by name.
 */
export async function getToolsForSkill(
  skill: SkillRow,
  systemTools: Record<string, AiTool>,
  ctx: ToolContext,
  db: Database,
): Promise<Record<string, AiTool>> {
  const result: Record<string, AiTool> = {};

  // System tools referenced by name
  const systemToolNames: string[] = JSON.parse(skill.systemToolNames);
  for (const name of systemToolNames) {
    if (systemTools[name]) {
      result[name] = systemTools[name];
    }
  }

  // Custom tools referenced by ID
  const toolIds: string[] = JSON.parse(skill.toolIds);
  if (toolIds.length > 0) {
    const custom = await loadCustomTools(db, ctx, toolIds);
    Object.assign(result, custom);
  }

  return result;
}

/**
 * Load tools from installed piece-based plugins.
 * Dynamically imports each piece package and converts its actions to AI SDK tools.
 */
export async function loadPieceTools(
  db: Database,
  serverUrl: string,
): Promise<Record<string, AiTool>> {
  const result: Record<string, AiTool> = {};

  // Find all installed plugins that are piece-based
  const installedPieces = await db
    .select()
    .from(plugins)
    .where(eq(plugins.status, "installed"));

  for (const plugin of installedPieces) {
    if (!plugin.pieceName) continue;

    try {
      const piece = await loadPiece(plugin.pieceName);
      if (!piece) continue;

      const credValue = await getCredentialForPlugin(db, plugin.pieceName);
      const tools = pieceActionsToTools({
        db,
        piece,
        serverUrl,
        credentialValue: credValue,
      });

      Object.assign(result, tools);
    } catch (err) {
      console.error(`Failed to load piece tools for "${plugin.pieceName}":`, err);
    }
  }

  return result;
}

/**
 * Get the full tool set for an agent: system tools + skills' tools + agent's direct tools.
 * Also returns the merged system prompt and model override.
 */
export async function getToolsForAgent(
  agentId: string,
  ctx: ToolContext,
  db: Database,
): Promise<{
  tools: Record<string, AiTool>;
  systemPromptFragments: string[];
  modelId: string | null;
  agentId: string;
  agentName: string;
}> {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const systemTools = createTools(ctx) as unknown as Record<string, AiTool>;
  const mergedTools: Record<string, AiTool> = { ...systemTools };

  const promptFragments: string[] = [agent.systemPrompt];

  // Resolve skills
  const skillIds: string[] = JSON.parse(agent.skillIds);
  if (skillIds.length > 0) {
    const skillRows = await db
      .select()
      .from(skills)
      .where(inArray(skills.id, skillIds));

    for (const skill of skillRows) {
      promptFragments.push(skill.systemPrompt);
      const skillTools = await getToolsForSkill(skill, systemTools, ctx, db);
      Object.assign(mergedTools, skillTools);
    }
  }

  // Agent's direct custom tools
  const directToolIds: string[] = JSON.parse(agent.toolIds);
  if (directToolIds.length > 0) {
    const directTools = await loadCustomTools(db, ctx, directToolIds);
    Object.assign(mergedTools, directTools);
  }

  // Piece-based plugin tools
  try {
    const serverUrl = process.env.API_URL || "http://localhost:3001";
    const pieceTools = await loadPieceTools(db, serverUrl);
    Object.assign(mergedTools, pieceTools);
  } catch (err) {
    console.error("Failed to load piece tools:", err);
  }

  return {
    tools: mergedTools,
    systemPromptFragments: promptFragments,
    modelId: agent.modelId,
    agentId: agent.id,
    agentName: agent.name,
  };
}

/**
 * Check if a custom tool (by name) is read-only.
 */
export async function isCustomToolReadOnly(
  toolName: string,
  db: Database,
): Promise<boolean> {
  const [row] = await db
    .select({ isReadOnly: customTools.isReadOnly })
    .from(customTools)
    .where(eq(customTools.name, toolName))
    .limit(1);
  return row?.isReadOnly ?? false;
}

// --- Tool Executors ---

async function executeHttpTool(
  args: Record<string, unknown>,
  config: Record<string, unknown>,
): Promise<unknown> {
  const { executeHttp } = await import("./tool-executors/http.js");
  return executeHttp(args, config);
}

async function executeQueryTool(
  args: Record<string, unknown>,
  config: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const { executeQuery } = await import("./tool-executors/query.js");
  return executeQuery(args, config, ctx);
}

async function executeCodeTool(
  args: Record<string, unknown>,
  config: Record<string, unknown>,
): Promise<unknown> {
  const { executeCode } = await import("./tool-executors/code.js");
  return executeCode(args, config);
}

async function executeCompositeTool(
  args: Record<string, unknown>,
  config: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const { executeComposite } = await import("./tool-executors/composite.js");
  return executeComposite(args, config, ctx);
}

async function executeMcpTool(
  args: Record<string, unknown>,
  config: Record<string, unknown>,
): Promise<unknown> {
  const { executeMcp } = await import("./tool-executors/mcp.js");
  return executeMcp(args, config);
}
