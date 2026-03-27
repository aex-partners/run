import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { conversations, agents, skills } from "../db/schema/index.js";
import { DEFAULT_AGENT_NAME } from "@aex/shared";
import { buildSystemPrompt } from "./prompts.js";
import type { AgentConfig } from "./types.js";

export async function resolveAgentForConversation(conversationId: string, userId?: string): Promise<AgentConfig> {
  const [conv] = await db
    .select({ agentId: conversations.agentId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  let agentName = DEFAULT_AGENT_NAME;
  let agentId = "default";
  let modelId: string | null = null;
  const agentPromptFragments: string[] = [];
  const allToolIds: string[] = [];

  if (conv?.agentId) {
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, conv.agentId))
      .limit(1);

    if (agent) {
      agentId = agent.id;
      agentName = agent.name;
      modelId = agent.modelId;
      if (agent.systemPrompt) agentPromptFragments.push(agent.systemPrompt);

      const toolIds: string[] = JSON.parse(agent.toolIds);
      allToolIds.push(...toolIds);

      // Load skills
      const skillIds: string[] = JSON.parse(agent.skillIds);
      if (skillIds.length > 0) {
        const skillRows = await db
          .select()
          .from(skills)
          .where(inArray(skills.id, skillIds));

        for (const skill of skillRows) {
          if (skill.systemPrompt) agentPromptFragments.push(skill.systemPrompt);
          const skillToolIds: string[] = JSON.parse(skill.toolIds);
          allToolIds.push(...skillToolIds);
        }
      }
    }
  }

  // Build system prompt dynamically from DB
  const systemPrompt = await buildSystemPrompt(db, {
    agentName,
    agentPromptFragments,
    userId,
  });

  return {
    id: agentId,
    name: agentName,
    systemPrompt,
    modelId,
    toolIds: [...new Set(allToolIds)],
    skillPrompts: agentPromptFragments,
  };
}
