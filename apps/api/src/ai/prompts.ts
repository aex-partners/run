import { eq, or, and, ne } from "drizzle-orm";
import { entities, settings, workflows, knowledge } from "../db/schema/index.js";
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
- You are this company's AI. Everything you do is from their perspective. If you need to understand what the company does, sells, or who their customers are, fetch their website first using WebFetch. Never guess about the company's business when you can look it up.
- Be efficient with tool calls. Do NOT repeat similar searches. If a search returns results, use them. Limit yourself to 3-5 web searches per request maximum.
- Present results as soon as you have useful data. Do not over-research.
- When asked to create or register a record, call insert_record immediately with the data provided.
- Use list_entities to check what exists before creating new ones.

For web research, ALWAYS use the web_search tool first to find URLs, then fetch_url to read specific pages. NEVER guess or fabricate URLs. Search first, fetch second.
For social media research, search via web_search (e.g. "site:instagram.com companyname"). NEVER access profile URLs directly (they block scraping). Individual post URLs from search results DO work.
`;

export async function buildSystemPrompt(
  db: Database,
  options?: {
    agentName?: string;
    agentPromptFragments?: string[];
    userId?: string;
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

  // User language
  const [langRow] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "locale.language"))
    .limit(1);

  if (langRow) {
    const lang = langRow.value.replace(/"/g, "");
    sections.push(`\nAlways respond in ${lang === "pt-BR" ? "Brazilian Portuguese" : lang}. Use proper grammar, accents, and punctuation for the language.`);
  }

  // Company context - load all company settings
  const companySettings = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings);

  const settingsMap = new Map<string, string>();
  for (const row of companySettings) {
    try {
      settingsMap.set(row.key, JSON.parse(row.value));
    } catch {
      settingsMap.set(row.key, row.value);
    }
  }

  const companyParts: string[] = [];
  const orgName = settingsMap.get("company.orgName");
  const website = settingsMap.get("company.website");
  const niche = settingsMap.get("company.niche");
  const subNiche = settingsMap.get("company.subNiche");
  const country = settingsMap.get("locale.country");

  if (orgName) companyParts.push(`Name: ${orgName}`);
  if (website) companyParts.push(`Website: ${website}`);
  if (niche) companyParts.push(`Industry: ${niche}`);
  if (subNiche) companyParts.push(`Segment: ${subNiche}`);
  if (country) companyParts.push(`Country: ${country}`);

  const profile = settingsMap.get("company_profile") as any;
  if (profile?.processes?.length > 0) {
    companyParts.push(`Active processes: ${profile.processes.join(", ")}`);
  }

  if (companyParts.length > 0) {
    sections.push(`\n## Company Context\n${companyParts.join("\n")}`);
  }

  // Knowledge (persistent memory)
  try {
    const knowledgeConditions = and(
      ne(knowledge.category, "file-content"),
      options?.userId
        ? or(
            eq(knowledge.scope, "company"),
            and(eq(knowledge.scope, "personal"), eq(knowledge.createdBy, options.userId)),
          )
        : eq(knowledge.scope, "company"),
    );

    const knowledgeRows = await db
      .select({
        category: knowledge.category,
        title: knowledge.title,
        content: knowledge.content,
        scope: knowledge.scope,
      })
      .from(knowledge)
      .where(knowledgeConditions!)
      .limit(30);

    if (knowledgeRows.length > 0) {
      const knowledgeLines = knowledgeRows.map(
        (k) => `- [${k.category}] ${k.title}: ${k.content}`,
      );
      // Cap at ~2000 chars to avoid bloating the prompt
      let knowledgeText = knowledgeLines.join("\n");
      if (knowledgeText.length > 2000) {
        knowledgeText = knowledgeText.slice(0, 2000) + "\n... (use query_knowledge tool for more)";
      }
      sections.push(`\n## Knowledge (what you know about this company)\n${knowledgeText}`);
    }
  } catch {
    // knowledge table might not exist yet
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
