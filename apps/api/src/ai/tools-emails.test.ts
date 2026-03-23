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

const db = getTestDb();
let tools: ReturnType<typeof createTools>;

const INTEGRATION_ID = "int-test-001";
const EMAIL_ACCOUNT_ID = "ea-test-001";
const OTHER_USER_ID = "test-user-no-email";

async function seedEmailData(db: ReturnType<typeof getTestDb>) {
  await db.insert(schema.integrations).values({
    id: INTEGRATION_ID,
    name: "Test Gmail",
    slug: "test-gmail",
    type: "oauth2",
    status: "enabled",
    config: "{}",
    credentials: "{}",
    createdBy: TEST_USER_ID,
  });

  await db.insert(schema.emailAccounts).values({
    id: EMAIL_ACCOUNT_ID,
    integrationId: INTEGRATION_ID,
    emailAddress: "test@buenaca.com.br",
    displayName: "Test Buenaça",
    provider: "gmail",
    syncStatus: "idle",
    ownerId: TEST_USER_ID,
  });

  await db.insert(schema.emails).values([
    {
      id: "em-test-001",
      accountId: EMAIL_ACCOUNT_ID,
      externalId: "ext-001",
      fromName: "Roberto Mendes",
      fromEmail: "comercial@tecelagem.com.br",
      to: '["test@buenaca.com.br"]',
      cc: '[]',
      subject: "Confirmação entrega tecidos",
      preview: "Boa tarde! Confirmo que os tecidos foram despachados...",
      bodyText: "Boa tarde! Confirmo que os 500m de algodão cru foram despachados via Plimor.",
      bodyHtml: "<p>Boa tarde! Confirmo que os 500m de algodão cru foram despachados via Plimor.</p>",
      folder: "inbox",
      read: 1,
      starred: 0,
      hasAttachment: 1,
      labels: '["Fornecedores"]',
      aiSummary: "Fornecedor confirma despacho de tecidos.",
      date: new Date("2026-03-01"),
    },
    {
      id: "em-test-002",
      accountId: EMAIL_ACCOUNT_ID,
      externalId: "ext-002",
      fromName: "Marcos Silva",
      fromEmail: "marcos@ctg.com.br",
      to: '["test@buenaca.com.br"]',
      cc: '[]',
      subject: "Orçamento bombachas CTG",
      preview: "Precisamos de 40 bombachas castelhanas...",
      bodyText: "Precisamos de 40 bombachas castelhanas tamanhos 38 a 48.",
      folder: "inbox",
      read: 0,
      starred: 1,
      hasAttachment: 0,
      labels: '["CTGs"]',
      date: new Date("2026-03-14"),
    },
    {
      id: "em-test-003",
      accountId: EMAIL_ACCOUNT_ID,
      externalId: "ext-003",
      fromName: "Buenaça",
      fromEmail: "test@buenaca.com.br",
      to: '["marcos@ctg.com.br"]',
      cc: '[]',
      subject: "Re: Orçamento bombachas CTG",
      preview: "Segue orçamento para 40 bombachas...",
      bodyText: "Segue orçamento ORC-2026-012 para 40 bombachas.",
      folder: "sent",
      read: 1,
      starred: 0,
      hasAttachment: 0,
      labels: '[]',
      date: new Date("2026-03-14"),
    },
  ]);
}

beforeAll(async () => {
  await cleanDb();
  await seedTestUser(db);

  // Seed a second user with no email account
  await db.insert(schema.users).values({
    id: OTHER_USER_ID,
    name: "No Email User",
    email: "noemail@aex.local",
    emailVerified: true,
    role: "member",
  }).onConflictDoNothing();

  await seedEmailData(db);
  tools = createTools(createToolContext(db));
});

afterAll(async () => {
  await closeTestDb();
});

// ---- list_emails ----

describe("tools: list_emails", () => {
  it("lists inbox emails by default", async () => {
    const result = await tools.list_emails.execute({}, { toolCallId: "tc1" });

    expect(result.error).toBeUndefined();
    expect(result.folder).toBe("inbox");
    expect(result.count).toBe(2);
    expect(result.emails).toHaveLength(2);

    const subjects = result.emails!.map((e: any) => e.subject);
    expect(subjects).toContain("Confirmação entrega tecidos");
    expect(subjects).toContain("Orçamento bombachas CTG");
  });

  it("lists sent folder emails", async () => {
    const result = await tools.list_emails.execute({ folder: "sent" }, { toolCallId: "tc2" });

    expect(result.error).toBeUndefined();
    expect(result.folder).toBe("sent");
    expect(result.count).toBe(1);
    expect(result.emails![0].subject).toBe("Re: Orçamento bombachas CTG");
  });

  it("filters by search keyword in subject", async () => {
    const result = await tools.list_emails.execute(
      { search: "bombachas" },
      { toolCallId: "tc3" },
    );

    expect(result.error).toBeUndefined();
    expect(result.count).toBe(1);
    expect(result.emails![0].subject).toContain("bombachas");
  });

  it("returns error when user has no email account", async () => {
    const noEmailTools = createTools(createToolContext(db, { userId: OTHER_USER_ID }));
    const result = await noEmailTools.list_emails.execute({}, { toolCallId: "tc4" });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("No email account connected");
  });
});

// ---- search_emails ----

describe("tools: search_emails", () => {
  it("finds emails matching query across all folders", async () => {
    const result = await tools.search_emails.execute(
      { query: "bombachas" },
      { toolCallId: "tc5" },
    );

    expect(result.error).toBeUndefined();
    expect(result.query).toBe("bombachas");
    expect(result.count).toBeGreaterThanOrEqual(1);

    const subjects = result.results!.map((e: any) => e.subject);
    expect(subjects.some((s: string) => s.toLowerCase().includes("bombachas"))).toBe(true);
  });

  it("returns empty results for nonexistent query", async () => {
    const result = await tools.search_emails.execute(
      { query: "xyznonexistent" },
      { toolCallId: "tc6" },
    );

    expect(result.error).toBeUndefined();
    expect(result.count).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it("returns error when user has no email account", async () => {
    const noEmailTools = createTools(createToolContext(db, { userId: OTHER_USER_ID }));
    const result = await noEmailTools.search_emails.execute(
      { query: "anything" },
      { toolCallId: "tc7" },
    );

    expect(result.error).toBeDefined();
    expect(result.error).toContain("No email account connected");
  });
});

// ---- summarize_email ----

describe("tools: summarize_email", () => {
  it("returns existing aiSummary directly", async () => {
    const result = await tools.summarize_email.execute(
      { email_id: "em-test-001" },
      { toolCallId: "tc8" },
    );

    expect(result.error).toBeUndefined();
    expect(result.summary).toBe("Fornecedor confirma despacho de tecidos.");
  });

  it("returns content and instruction when no aiSummary exists", async () => {
    const result = await tools.summarize_email.execute(
      { email_id: "em-test-002" },
      { toolCallId: "tc9" },
    );

    expect(result.error).toBeUndefined();
    expect(result.summary).toBeUndefined();
    expect(result.content).toBeDefined();
    expect(result.content).toContain("bombachas");
    expect(result.instruction).toBeDefined();
    expect(result.subject).toBe("Orçamento bombachas CTG");
  });

  it("returns error for non-existent email", async () => {
    const result = await tools.summarize_email.execute(
      { email_id: "em-does-not-exist" },
      { toolCallId: "tc10" },
    );

    expect(result.error).toBe("Email not found");
  });
});

// ---- draft_email_reply ----

describe("tools: draft_email_reply", () => {
  it("returns email content and draft instructions", async () => {
    const result = await tools.draft_email_reply.execute(
      { email_id: "em-test-002" },
      { toolCallId: "tc11" },
    );

    expect(result.error).toBeUndefined();
    expect(result.id).toBe("em-test-002");
    expect(result.from).toContain("Marcos Silva");
    expect(result.from).toContain("marcos@ctg.com.br");
    expect(result.subject).toBe("Orçamento bombachas CTG");
    expect(result.content).toContain("bombachas");
    expect(result.instructions).toBe("Draft a professional reply.");
    expect(result.instruction).toBeDefined();
  });

  it("passes custom instructions when provided", async () => {
    const result = await tools.draft_email_reply.execute(
      { email_id: "em-test-002", instructions: "accept the order and confirm delivery in 15 days" },
      { toolCallId: "tc12" },
    );

    expect(result.error).toBeUndefined();
    expect(result.instructions).toBe("accept the order and confirm delivery in 15 days");
  });

  it("returns error for non-existent email", async () => {
    const result = await tools.draft_email_reply.execute(
      { email_id: "em-does-not-exist" },
      { toolCallId: "tc13" },
    );

    expect(result.error).toBe("Email not found");
  });
});

// ---- send_email ----

describe("tools: send_email", () => {
  it("returns error when user has no email account", async () => {
    const noEmailTools = createTools(createToolContext(db, { userId: OTHER_USER_ID }));
    const result = await noEmailTools.send_email.execute(
      { to: "someone@example.com", subject: "Test", body: "Hello" },
      { toolCallId: "tc14" },
    );

    expect(result.error).toBeDefined();
    expect(result.error).toContain("No email account connected");
  });
});
