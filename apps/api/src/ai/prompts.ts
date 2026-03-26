import { eq } from "drizzle-orm";
import { entities, settings, workflows } from "../db/schema/index.js";
import { parseFields } from "../db/entity-fields.js";
import type { Database } from "../db/index.js";

const BASE_PROMPT = `You are Eric, the AI assistant of AEX Run, an AI-First, self-hosted, single-tenant ERP system.

AEX Run is not a traditional ERP. Users interact entirely through you. You are the primary interface. Everything the user needs (data, reports, automation, research) goes through you and your tools.

Rules:
- NEVER use emojis. Not a single one. No emoticons either.
- Be concise and direct. Short sentences, no filler words.
- Use tools when the user asks to perform an action. Call them immediately.
- When the user speaks in business language (order, invoice, customer), map to existing entities.
- If a relevant entity does not exist, propose creating it.
- You know the company deeply. Use the company context below to give informed, specific advice.
- Be efficient with tool calls. Do NOT repeat similar searches. If a search returns results, use them. Limit yourself to 3-5 web searches per request maximum.
- Present results as soon as you have useful data. Do not over-research.
- When asked to create or register a record, call insert_record immediately with the data provided.
- Use list_entities to check what exists before creating new ones.
`;

export async function buildSystemPrompt(
  db: Database,
  options?: {
    agentName?: string;
    agentPromptFragments?: string[];
  },
): Promise<string> {
  const sections: string[] = [];

  // Base prompt with agent name
  const basePrompt = options?.agentName
    ? BASE_PROMPT.replace("You are Eric,", `You are ${options.agentName},`)
    : BASE_PROMPT;
  sections.push(basePrompt);

  // Agent/skill prompt fragments
  if (options?.agentPromptFragments?.length) {
    for (const fragment of options.agentPromptFragments) {
      if (fragment) sections.push(`\n## Agent Instructions\n${fragment}`);
    }
  }

  // Company context
  const [profileRow] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "company_profile"))
    .limit(1);

  if (profileRow) {
    try {
      const profile = JSON.parse(profileRow.value) as { name?: string; type: string; processes: string[]; notes?: string };
      const parts: string[] = [];
      if (profile.name) parts.push(`Company: ${profile.name}`);
      parts.push(`Type: ${profile.type}`);
      if (profile.processes.length > 0) parts.push(`Key processes: ${profile.processes.join(", ")}`);
      if (profile.notes) parts.push(`Notes: ${profile.notes}`);
      sections.push(`\n## Company Context\n${parts.join("\n")}`);
    } catch {
      // ignore
    }
  }

  // Available entities
  const allEntities = await db
    .select({
      name: entities.name,
      description: entities.description,
      aiContext: entities.aiContext,
      fields: entities.fields,
    })
    .from(entities);

  if (allEntities.length > 0) {
    const entityBlocks: string[] = [];
    let totalTokens = 0;

    for (const e of allEntities) {
      const fields = parseFields(e.fields);
      const fieldList = fields.map((f) => `${f.name}:${f.type}`).join(", ");
      const desc = e.aiContext || e.description || "";
      const block = `### ${e.name}\n${desc}\nFields: ${fieldList}`;
      const blockTokens = Math.ceil(block.length / 4);
      if (totalTokens + blockTokens > 4000) {
        entityBlocks.push("... (use list_entities tool for complete list)");
        break;
      }
      entityBlocks.push(block);
      totalTokens += blockTokens;
    }

    sections.push(`\n## Available Entities\n${entityBlocks.join("\n\n")}`);
  }

  // Active workflows
  try {
    const activeWorkflows = await db
      .select({ name: workflows.name, triggerType: workflows.triggerType })
      .from(workflows)
      .where(eq(workflows.status, "active"));

    if (activeWorkflows.length > 0) {
      const lines = activeWorkflows.slice(0, 20).map((wf) => `- ${wf.name} (${wf.triggerType})`);
      sections.push(`\n## Active Workflows\n${lines.join("\n")}`);
    }
  } catch {
    // workflows table might not exist yet
  }

  return sections.join("\n");
}
