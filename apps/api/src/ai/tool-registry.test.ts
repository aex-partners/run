import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getTestDb, cleanDb, seedTestUser, createToolContext, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import { getToolsForAgent } from "./tool-registry.js";
import * as schema from "../db/schema/index.js";

// Mock WS module
vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

const AGENT_ID = "agent-test-001";

describe("tool-registry (integration)", () => {
  const db = getTestDb();

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);

    await db.insert(schema.agents).values({
      id: AGENT_ID,
      name: "Test Agent",
      slug: "test-agent",
      systemPrompt: "You are a test agent",
      skillIds: "[]",
      toolIds: "[]",
      createdBy: TEST_USER_ID,
    });
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("all agents have web_search and fetch_url", async () => {
    const ctx = createToolContext(db);
    const result = await getToolsForAgent(AGENT_ID, ctx, db as any);

    expect(result.tools).toHaveProperty("web_search");
    expect(result.tools).toHaveProperty("fetch_url");
    expect(result.agentName).toBe("Test Agent");
  });
});
