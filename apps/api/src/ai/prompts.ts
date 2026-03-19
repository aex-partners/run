import { eq, sql } from "drizzle-orm";
import { entities, entityRecords, settings, workflows } from "../db/schema/index.js";
import { parseFields } from "../db/entity-fields.js";
import type { Database } from "../db/index.js";

const BASE_PROMPT = `You are Eric, an AI assistant inside a self-hosted ERP system called RUN.

Your role:
- Respond conversationally to questions, opinions, and general chat
- Use tools when the user asks to perform an action (create conversations, list users, manage tasks, etc.)
- Always explain what you're about to do before using a tool
- Keep responses concise and helpful
- You are part of the ERP system, so you have access to manage conversations, users, and tasks

When the user speaks in business language (order, invoice, customer, product, supplier, stock), map those terms to existing entities. If a relevant entity does not exist but the context suggests it should, propose creating it.

Never ask the user to speak in technical terms. Interpret business intent and translate it into the appropriate tools and entities.

You can create background tasks for long-running operations using create_task. Tasks run asynchronously and are processed by a worker. Use tasks for bulk operations, report generation, or multi-step processes that should not block the conversation. Tasks can be scheduled to run after a delay using schedule_in_minutes (e.g. "schedule this for 5 minutes from now").

You can create dynamic database entities (tables) with create_entity, add fields with add_field, and manage records with query_records, insert_record, update_record, delete_record. When users want to create a table or store structured data, use these tools. When querying, present results in a readable format.

Use list_entities to check what entities already exist before creating new ones or when you need to understand the current data model.

You can create automated workflows using create_workflow. Workflows consist of triggers (manual, cron schedule, or event-based), action steps (AI-executed operations), condition steps (branching logic), and notification steps. When a user describes a recurring process, automation, or scheduled operation, proactively suggest creating a workflow. Always create the workflow with complete steps, never ask the user to manually configure nodes. Use list_workflows to check existing workflows. Use execute_workflow to trigger a manual execution. Use update_workflow to modify existing workflows.

When the user asks you to do something that requires a tool, use the appropriate tool immediately. Do not just describe what you would do; actually call the tool.

IMPORTANT: When a user asks you to create, register, or add a record (customer, product, order, etc.), call insert_record right away with the data provided. Do not spend multiple steps researching or searching before inserting. If the user already provided the data, use it directly. Only use web_search or query_records first if the user's request is ambiguous and you genuinely need more information to fill required fields.

`;

interface CompanyProfile {
  name?: string;
  type: string;
  processes: string[];
  notes?: string;
}

export async function buildSystemPrompt(
  db: Database,
  options?: {
    agentPromptFragments?: string[];
    agentName?: string;
  },
): Promise<{ prompt: string; isOnboarding: boolean }> {
  // Load company profile
  let companyProfile: CompanyProfile | null = null;
  const [profileRow] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "company_profile"))
    .limit(1);

  if (profileRow) {
    try {
      companyProfile = JSON.parse(profileRow.value) as CompanyProfile;
    } catch {
      // ignore malformed
    }
  }

  // Load entities with field info, descriptions, and AI context
  const allEntities = await db
    .select({
      id: entities.id,
      name: entities.name,
      description: entities.description,
      aiContext: entities.aiContext,
      fields: entities.fields,
    })
    .from(entities);

  // Build prompt sections
  const basePromptToUse = options?.agentName
    ? BASE_PROMPT.replace("You are Eric,", `You are ${options.agentName},`)
    : BASE_PROMPT;
  const sections: string[] = [basePromptToUse];

  // Agent and skill prompt fragments
  if (options?.agentPromptFragments?.length) {
    for (const fragment of options.agentPromptFragments) {
      sections.push(`\n## Agent Instructions\n${fragment}`);
    }
  }

  // Company context
  if (companyProfile) {
    const parts: string[] = [];
    if (companyProfile.name) parts.push(`Company: ${companyProfile.name}`);
    parts.push(`Type: ${companyProfile.type}`);
    if (companyProfile.processes.length > 0) {
      parts.push(`Key processes: ${companyProfile.processes.join(", ")}`);
    }
    if (companyProfile.notes) parts.push(`Notes: ${companyProfile.notes}`);
    sections.push(`\n## Company Context\n${parts.join("\n")}`);
  }

  // Available entities: read everything from the DB
  if (allEntities.length > 0) {
    const entityBlocks: string[] = [];
    let totalTokens = 0;

    for (const e of allEntities) {
      const fields = parseFields(e.fields);
      const fieldList = fields.map((f) => `${f.name}:${f.type}`).join(", ");

      let block: string;
      if (e.aiContext) {
        // Rich context: entity has AI knowledge (from template or AI-generated)
        block = `### ${e.name}\n${e.aiContext}\nFields: ${fieldList}`;
      } else {
        // Minimal context: entity with just description or nothing
        const desc = e.description ? `${e.description} ` : "";
        block = `### ${e.name}\n${desc}Fields: ${fieldList}`;
      }

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
  const activeWorkflows = await db
    .select({
      name: workflows.name,
      triggerType: workflows.triggerType,
      triggerConfig: workflows.triggerConfig,
    })
    .from(workflows)
    .where(eq(workflows.status, "active"));

  if (activeWorkflows.length > 0) {
    const workflowLines: string[] = [];
    let totalTokens = 0;

    for (const wf of activeWorkflows) {
      let triggerLabel = wf.triggerType;
      if (wf.triggerType === "cron") {
        try {
          const config = JSON.parse(wf.triggerConfig);
          if (config.cronExpression) triggerLabel = `cron: ${config.cronExpression}`;
        } catch { /* ignore */ }
      }
      const line = `- ${wf.name} (${triggerLabel})`;
      const lineTokens = Math.ceil(line.length / 4);
      if (totalTokens + lineTokens > 500) {
        workflowLines.push("- ... (use list_workflows for complete list)");
        break;
      }
      workflowLines.push(line);
      totalTokens += lineTokens;
    }

    sections.push(`\n## Active Workflows\n${workflowLines.join("\n")}`);
  }

  return { prompt: sections.join("\n"), isOnboarding: false };
}
