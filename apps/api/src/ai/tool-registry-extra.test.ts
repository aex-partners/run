import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, seedTestUser, createToolContext, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import { getToolsForAgent, isCustomToolReadOnly } from "./tool-registry.js";
import * as schema from "../db/schema/index.js";

vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

describe("tool-registry extra coverage", () => {
  const db = getTestDb();

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("getToolsForAgent throws for nonexistent agent", async () => {
    const ctx = createToolContext(db);
    await expect(
      getToolsForAgent("agent-does-not-exist", ctx, db as any),
    ).rejects.toThrow("Agent not found");
  });

  it("getToolsForAgent with skills merges skill system tools", async () => {
    // Create skill
    const skillId = "skill-test-001";
    await db.insert(schema.skills).values({
      id: skillId,
      name: "Test Skill",
      slug: "test-skill",
      systemPrompt: "You can query records",
      toolIds: "[]",
      systemToolNames: '["query_records","list_entities"]',
      guardrails: "{}",
      createdBy: TEST_USER_ID,
    });

    // Create agent with this skill
    const agentId = "agent-skill-test-001";
    await db.insert(schema.agents).values({
      id: agentId,
      name: "Skill Agent",
      slug: "skill-agent",
      systemPrompt: "Base prompt",

      skillIds: JSON.stringify([skillId]),
      toolIds: "[]",
      createdBy: TEST_USER_ID,
    });

    const ctx = createToolContext(db);
    const result = await getToolsForAgent(agentId, ctx, db as any);

    expect(result.tools).toHaveProperty("query_records");
    expect(result.tools).toHaveProperty("list_entities");
    expect(result.systemPromptFragments).toHaveLength(2); // agent prompt + skill prompt
    expect(result.systemPromptFragments).toContain("You can query records");
    expect(result.agentName).toBe("Skill Agent");

    // Web tools are always available
    expect(result.tools).toHaveProperty("web_search");
    expect(result.tools).toHaveProperty("fetch_url");
  });

  it("isCustomToolReadOnly returns false for nonexistent tool", async () => {
    const result = await isCustomToolReadOnly("nonexistent_custom_tool", db as any);
    expect(result).toBe(false);
  });

  it("isCustomToolReadOnly returns true for read-only custom tool", async () => {
    await db.insert(schema.customTools).values({
      id: "ct-readonly-001",
      name: "my_readonly_tool",
      description: "A read-only tool",
      inputSchema: '{"type":"object","properties":{}}',
      type: "code",
      config: "{}",
      isReadOnly: true,
      createdBy: TEST_USER_ID,
    });

    const result = await isCustomToolReadOnly("my_readonly_tool", db as any);
    expect(result).toBe(true);

    // Cleanup
    await db.delete(schema.customTools).where(eq(schema.customTools.id, "ct-readonly-001"));
  });

  it("disabled plugin tools are excluded from agent", async () => {
    // Create plugin
    const pluginId = "plugin-disabled-001";
    await db.insert(schema.plugins).values({
      id: pluginId,
      name: "Disabled Plugin",
      version: "1.0.0",
      manifest: "{}",
      source: "local",
      status: "disabled",
    });

    // Create custom tool linked to this plugin
    await db.insert(schema.customTools).values({
      id: "ct-disabled-001",
      name: "disabled_tool",
      description: "Should be excluded",
      inputSchema: '{"type":"object","properties":{}}',
      type: "code",
      config: '{"code":"return 1"}',
      isReadOnly: false,
      pluginId,
      createdBy: TEST_USER_ID,
    });

    // Create agent with this tool
    const agentId = "agent-disabled-plugin-001";
    await db.insert(schema.agents).values({
      id: agentId,
      name: "Plugin Agent",
      slug: "plugin-agent",
      systemPrompt: "test",

      skillIds: "[]",
      toolIds: JSON.stringify(["ct-disabled-001"]),
      createdBy: TEST_USER_ID,
    });

    const ctx = createToolContext(db);
    const result = await getToolsForAgent(agentId, ctx, db as any);

    // Tool from disabled plugin should NOT be in the tool set
    expect(result.tools).not.toHaveProperty("disabled_tool");

    // Cleanup
    await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
    await db.delete(schema.customTools).where(eq(schema.customTools.id, "ct-disabled-001"));
    await db.delete(schema.plugins).where(eq(schema.plugins.id, pluginId));
  });
});
