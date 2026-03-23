import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, seedTestUser, createToolContext, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import { createTools } from "./tools.js";
import * as schema from "../db/schema/index.js";

vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

vi.mock("../files/storage.js", () => ({
  localStorage: {
    saveFile: vi.fn().mockResolvedValue("files/test-uuid.csv"),
    getFilePath: vi.fn((p: string) => `/tmp/uploads/${p}`),
    deleteFile: vi.fn(),
  },
  getFileType: (name: string) => name.split(".").pop() || "file",
  getMimeType: (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = { csv: "text/csv", json: "application/json", txt: "text/plain", pdf: "application/pdf" };
    return map[ext || ""] || "application/octet-stream";
  },
}));

const db = getTestDb();
let tools: ReturnType<typeof createTools>;

beforeAll(async () => {
  await cleanDb();
  await seedTestUser(db);
  tools = createTools(createToolContext(db));
});

afterAll(async () => {
  await closeTestDb();
});

describe("tools: create_folder", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "files"`));
  });

  it("creates a root folder", async () => {
    const result = await tools.create_folder.execute(
      { name: "Documentos" },
      { toolCallId: "tc1" },
    );

    expect(result.id).toBeDefined();
    expect(result.name).toBe("Documentos");

    const [row] = await db.select().from(schema.files).where(eq(schema.files.id, result.id));
    expect(row).toBeDefined();
    expect(row.isFolder).toBe(1);
    expect(row.type).toBe("folder");
    expect(row.ownerId).toBe(TEST_USER_ID);
    expect(row.parentId).toBeNull();
  });

  it("creates a nested folder with parent_id", async () => {
    const parent = await tools.create_folder.execute(
      { name: "Raiz" },
      { toolCallId: "tc2" },
    );

    const child = await tools.create_folder.execute(
      { name: "Subfolder", parent_id: parent.id },
      { toolCallId: "tc3" },
    );

    expect(child.id).toBeDefined();
    expect(child.name).toBe("Subfolder");

    const [row] = await db.select().from(schema.files).where(eq(schema.files.id, child.id));
    expect(row.parentId).toBe(parent.id);
    expect(row.isFolder).toBe(1);
  });
});

describe("tools: create_file", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "files"`));
  });

  it("creates a CSV file from content", async () => {
    const csvContent = "nome,valor\nProduto A,100\nProduto B,200";
    const result = await tools.create_file.execute(
      { name: "relatorio.csv", content: csvContent },
      { toolCallId: "tc4" },
    );

    expect(result.id).toBeDefined();
    expect(result.name).toBe("relatorio.csv");
    expect(result.size).toBe(Buffer.from(csvContent, "utf8").length);

    const [row] = await db.select().from(schema.files).where(eq(schema.files.id, result.id));
    expect(row).toBeDefined();
    expect(row.name).toBe("relatorio.csv");
    expect(row.type).toBe("csv");
    expect(row.mimeType).toBe("text/csv");
    expect(row.source).toBe("generated");
    expect(row.ownerId).toBe(TEST_USER_ID);
  });

  it("creates a JSON file with source=chat", async () => {
    const jsonContent = JSON.stringify({ items: [1, 2, 3] });
    const result = await tools.create_file.execute(
      { name: "dados.json", content: jsonContent, source: "chat" },
      { toolCallId: "tc5" },
    );

    expect(result.id).toBeDefined();
    expect(result.name).toBe("dados.json");

    const [row] = await db.select().from(schema.files).where(eq(schema.files.id, result.id));
    expect(row.type).toBe("json");
    expect(row.mimeType).toBe("application/json");
    expect(row.source).toBe("chat");
  });
});

describe("tools: list_files", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "files"`));

    await db.insert(schema.files).values([
      {
        id: "file-test-001",
        name: "Relatorio_Q1.pdf",
        type: "pdf",
        mimeType: "application/pdf",
        size: 150000,
        path: "/files/test1.pdf",
        source: "upload",
        ownerId: TEST_USER_ID,
      },
      {
        id: "file-test-002",
        name: "Planilha_Vendas.csv",
        type: "csv",
        mimeType: "text/csv",
        size: 5000,
        path: "/files/test2.csv",
        source: "chat",
        starred: 1,
        ownerId: TEST_USER_ID,
      },
      {
        id: "file-test-003",
        name: "Notas_Fiscais.txt",
        type: "txt",
        mimeType: "text/plain",
        size: 800,
        path: "/files/test3.txt",
        source: "generated",
        ownerId: TEST_USER_ID,
      },
    ]);
  });

  it("lists all files owned by user", async () => {
    const result = await tools.list_files.execute({}, { toolCallId: "tc6" });

    expect(result.files).toHaveLength(3);
    const names = result.files.map((f: any) => f.name);
    expect(names).toContain("Relatorio_Q1.pdf");
    expect(names).toContain("Planilha_Vendas.csv");
    expect(names).toContain("Notas_Fiscais.txt");
  });

  it("filters by search term (ilike on name)", async () => {
    const result = await tools.list_files.execute(
      { search: "relatorio" },
      { toolCallId: "tc7" },
    );

    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe("Relatorio_Q1.pdf");
  });

  it("filters starred files only", async () => {
    const result = await tools.list_files.execute(
      { starred: true },
      { toolCallId: "tc8" },
    );

    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe("Planilha_Vendas.csv");
    expect(result.files[0].starred).toBe(true);
  });
});

describe("tools: search_files", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "files"`));

    await db.insert(schema.files).values([
      {
        id: "file-test-010",
        name: "Contrato_SolGreen.pdf",
        type: "pdf",
        mimeType: "application/pdf",
        size: 200000,
        path: "/files/contrato.pdf",
        source: "upload",
        ownerId: TEST_USER_ID,
      },
      {
        id: "file-test-011",
        name: "Orcamento_2024.csv",
        type: "csv",
        mimeType: "text/csv",
        size: 3000,
        path: "/files/orcamento.csv",
        source: "generated",
        ownerId: TEST_USER_ID,
      },
    ]);
  });

  it("finds files matching query", async () => {
    const result = await tools.search_files.execute(
      { query: "Contrato" },
      { toolCallId: "tc9" },
    );

    expect(result.query).toBe("Contrato");
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe("Contrato_SolGreen.pdf");
    expect(result.results[0].id).toBe("file-test-010");
  });

  it("returns empty for no match", async () => {
    const result = await tools.search_files.execute(
      { query: "inexistente_xyz" },
      { toolCallId: "tc10" },
    );

    expect(result.results).toHaveLength(0);
  });
});
