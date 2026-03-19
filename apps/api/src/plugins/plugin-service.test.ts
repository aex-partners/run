import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, seedTestUser, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import * as schema from "../db/schema/index.js";
import { installPlugin, uninstallPlugin, configurePlugin, setPluginStatus } from "./plugin-service.js";

const PLUGIN_ID = "plugin-test-001";

const testManifest = {
  id: PLUGIN_ID,
  name: "Test Plugin",
  description: "A test plugin",
  version: "1.0.0",
  author: "Test",
  category: "utility",
  tools: [
    {
      name: "greet",
      description: "Greet someone",
      inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      type: "code",
      config: { code: "return `Hello ${args.name}`" },
    },
    {
      name: "farewell",
      description: "Say goodbye",
      inputSchema: { type: "object", properties: { name: { type: "string" } } },
      type: "code",
      config: { code: "return `Bye ${args.name}`" },
    },
  ],
};

describe("plugin-service (integration)", () => {
  const db = getTestDb();

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);
  });

  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "custom_tools"`));
    await db.execute(sql.raw(`DELETE FROM "plugins"`));

    // Seed plugin row
    await db.insert(schema.plugins).values({
      id: PLUGIN_ID,
      name: "Test Plugin",
      description: "A test plugin",
      version: "1.0.0",
      author: "Test",
      category: "utility",
      manifest: JSON.stringify(testManifest),
      source: "local",
      status: "available",
    });
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("installPlugin materializes tools as custom_tools rows", async () => {
    await installPlugin(db as any, PLUGIN_ID, TEST_USER_ID);

    const [plugin] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.id, PLUGIN_ID));
    expect(plugin.status).toBe("installed");
    expect(plugin.installedBy).toBe(TEST_USER_ID);
    expect(plugin.installedAt).not.toBeNull();

    const tools = await db
      .select()
      .from(schema.customTools)
      .where(eq(schema.customTools.pluginId, PLUGIN_ID));
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toContain(`${PLUGIN_ID}:greet`);
    expect(tools.map((t) => t.name)).toContain(`${PLUGIN_ID}:farewell`);
  });

  it("installPlugin is idempotent (no-op if already installed)", async () => {
    await installPlugin(db as any, PLUGIN_ID, TEST_USER_ID);
    await installPlugin(db as any, PLUGIN_ID, TEST_USER_ID); // second call

    const tools = await db
      .select()
      .from(schema.customTools)
      .where(eq(schema.customTools.pluginId, PLUGIN_ID));
    expect(tools).toHaveLength(2); // not duplicated
  });

  it("uninstallPlugin removes tools and resets status", async () => {
    await installPlugin(db as any, PLUGIN_ID, TEST_USER_ID);
    await uninstallPlugin(db as any, PLUGIN_ID);

    const [plugin] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.id, PLUGIN_ID));
    expect(plugin.status).toBe("available");
    expect(plugin.installedAt).toBeNull();
    expect(plugin.config).toBe("{}");

    const tools = await db
      .select()
      .from(schema.customTools)
      .where(eq(schema.customTools.pluginId, PLUGIN_ID));
    expect(tools).toHaveLength(0);
  });

  it("configurePlugin updates config JSON", async () => {
    await installPlugin(db as any, PLUGIN_ID, TEST_USER_ID);
    await configurePlugin(db as any, PLUGIN_ID, { apiKey: "abc123", enabled: true });

    const [plugin] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.id, PLUGIN_ID));
    const config = JSON.parse(plugin.config);
    expect(config.apiKey).toBe("abc123");
    expect(config.enabled).toBe(true);
  });

  it("setPluginStatus toggles between installed and disabled", async () => {
    await installPlugin(db as any, PLUGIN_ID, TEST_USER_ID);

    await setPluginStatus(db as any, PLUGIN_ID, false);
    let [plugin] = await db.select().from(schema.plugins).where(eq(schema.plugins.id, PLUGIN_ID));
    expect(plugin.status).toBe("disabled");

    await setPluginStatus(db as any, PLUGIN_ID, true);
    [plugin] = await db.select().from(schema.plugins).where(eq(schema.plugins.id, PLUGIN_ID));
    expect(plugin.status).toBe("installed");
  });

  it("setPluginStatus throws for non-installed plugin", async () => {
    // Plugin is "available", not installed
    await expect(setPluginStatus(db as any, PLUGIN_ID, true)).rejects.toThrow(
      "not installed",
    );
  });
});
