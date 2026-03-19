import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
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

const AGENT_NO_WEB = "agent-no-web-001";
const AGENT_WITH_WEB = "agent-with-web-001";

describe("tool-registry (integration)", () => {
  const db = getTestDb();

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);

    // Create agent without internet access
    await db.insert(schema.agents).values({
      id: AGENT_NO_WEB,
      name: "No Web Agent",
      slug: "no-web-agent",
      systemPrompt: "You are a test agent without internet",
      internetAccess: false,
      skillIds: "[]",
      toolIds: "[]",
      createdBy: TEST_USER_ID,
    });

    // Create agent with internet access
    await db.insert(schema.agents).values({
      id: AGENT_WITH_WEB,
      name: "Web Agent",
      slug: "web-agent",
      systemPrompt: "You are a test agent with internet",
      internetAccess: true,
      skillIds: "[]",
      toolIds: "[]",
      createdBy: TEST_USER_ID,
    });
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("agent without internetAccess has no web_search/fetch_url", async () => {
    const ctx = createToolContext(db);
    const result = await getToolsForAgent(AGENT_NO_WEB, ctx, db as any);

    expect(result.tools).not.toHaveProperty("web_search");
    expect(result.tools).not.toHaveProperty("fetch_url");
    expect(result.agentName).toBe("No Web Agent");
  });

  it("agent with internetAccess has web_search/fetch_url", async () => {
    const ctx = createToolContext(db);
    const result = await getToolsForAgent(AGENT_WITH_WEB, ctx, db as any);

    expect(result.tools).toHaveProperty("web_search");
    expect(result.tools).toHaveProperty("fetch_url");
    expect(result.agentName).toBe("Web Agent");
  });
});
