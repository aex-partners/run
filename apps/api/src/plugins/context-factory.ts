/**
 * Creates ActionContext instances for piece action execution.
 * Bridges AEX's credentials/store/files systems with the AP framework's context interfaces.
 */

import { eq, and } from "drizzle-orm";
import { credentials, pluginStore } from "../db/schema/index.js";
import type { Database } from "../db/index.js";
import type {
  ActionContext,
  Store,
  ConnectionsManager,
  FilesService,
  ServerContext,
  StoreScope,
} from "@activepieces/pieces-framework";

/**
 * Create an ActionContext for executing a piece action within AEX.
 */
export function createActionContext(opts: {
  db: Database;
  pluginName: string;
  auth: unknown;
  propsValue: Record<string, unknown>;
  serverUrl: string;
}): Omit<ActionContext<unknown, Record<string, unknown>>, "executionType"> {
  const { db, pluginName, auth, propsValue, serverUrl } = opts;

  return {
    auth,
    propsValue,
    store: createStore(db, pluginName),
    connections: createConnectionsManager(db),
    files: createFilesService(),
    server: createServerContext(serverUrl),
    project: { id: "default", externalId: undefined },
    run: {
      id: "inline",
      stop: () => Promise.resolve(),
      pause: () => Promise.resolve(),
    },
    flows: {
      list: () => Promise.resolve({ data: [], next: null, previous: null }),
      current: {
        id: "inline",
        version: {
          id: "inline",
          flowId: "inline",
          displayName: "",
          trigger: {},
          state: "locked",
          valid: true,
        },
      },
    },
    tags: {
      add: () => Promise.resolve(),
    },
    output: {
      set: () => Promise.resolve(),
    },
    agent: undefined,
    generateResumeUrl: () => Promise.resolve(""),
    step: { name: "inline", type: "PIECE" },
  } as unknown as Omit<ActionContext<unknown, Record<string, unknown>>, "executionType">;
}

/**
 * Store implementation backed by the plugin_store table.
 */
function createStore(db: Database, pluginName: string): Store {
  return {
    async put(key: string, value: unknown, scope?: StoreScope): Promise<void> {
      const scopeVal = scope === 1 ? "flow" : "project"; // StoreScope.FLOW = 1
      const id = crypto.randomUUID();
      const now = new Date();
      const serialized = JSON.stringify(value);

      // Upsert
      const existing = await db
        .select()
        .from(pluginStore)
        .where(
          and(
            eq(pluginStore.pluginName, pluginName),
            eq(pluginStore.scope, scopeVal),
            eq(pluginStore.key, key),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(pluginStore)
          .set({ value: serialized, updatedAt: now })
          .where(eq(pluginStore.id, existing[0].id));
      } else {
        await db.insert(pluginStore).values({
          id,
          pluginName,
          scope: scopeVal,
          key,
          value: serialized,
          createdAt: now,
          updatedAt: now,
        });
      }
    },

    async get<T>(key: string, scope?: StoreScope): Promise<T | null> {
      const scopeVal = scope === 1 ? "flow" : "project";
      const [row] = await db
        .select()
        .from(pluginStore)
        .where(
          and(
            eq(pluginStore.pluginName, pluginName),
            eq(pluginStore.scope, scopeVal),
            eq(pluginStore.key, key),
          ),
        )
        .limit(1);

      if (!row) return null;
      return JSON.parse(row.value) as T;
    },

    async delete(key: string, scope?: StoreScope): Promise<void> {
      const scopeVal = scope === 1 ? "flow" : "project";
      const [row] = await db
        .select()
        .from(pluginStore)
        .where(
          and(
            eq(pluginStore.pluginName, pluginName),
            eq(pluginStore.scope, scopeVal),
            eq(pluginStore.key, key),
          ),
        )
        .limit(1);

      if (row) {
        await db.delete(pluginStore).where(eq(pluginStore.id, row.id));
      }
    },
  };
}

/**
 * ConnectionsManager backed by the credentials table.
 */
function createConnectionsManager(db: Database): ConnectionsManager {
  return {
    async get(connectionName: string): Promise<Record<string, unknown> | null> {
      const [row] = await db
        .select()
        .from(credentials)
        .where(eq(credentials.name, connectionName))
        .limit(1);

      if (!row) return null;

      try {
        const { decryptCredentials } = await import("../integrations/crypto.js");
        return decryptCredentials(row.value) as Record<string, unknown>;
      } catch {
        try {
          return JSON.parse(row.value) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    },
  };
}

/**
 * Stub FilesService. Stores files in memory for now.
 */
function createFilesService(): FilesService {
  return {
    async write(params: { fileName: string; data: Buffer }): Promise<string> {
      // TODO: integrate with AEX file system
      console.warn(`FilesService.write called for "${params.fileName}" (stub)`);
      return `file://${params.fileName}`;
    },
  };
}

/**
 * Server context providing API URLs.
 */
function createServerContext(serverUrl: string): ServerContext {
  return {
    apiUrl: serverUrl,
    publicUrl: serverUrl,
    token: "",
  };
}
