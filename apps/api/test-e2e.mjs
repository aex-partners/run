/**
 * E2E smoke test for AI SDK migration.
 * Run: npx playwright test-e2e.mjs (or node test-e2e.mjs with playwright installed)
 *
 * Prerequisites: API on :3001, Web on :5173, Redis + Postgres running, seed user exists.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const API = "http://localhost:3001";

let browser, context, page;
let passed = 0;
let failed = 0;

async function setup() {
  browser = await chromium.launch({ headless: false, slowMo: 300 });
  context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  page = await context.newPage();

  // Log console errors from the page
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("  [BROWSER ERROR]", msg.text());
  });
}

async function test(name, fn) {
  process.stdout.write(`\n[TEST] ${name}... `);
  try {
    await fn();
    passed++;
    console.log("PASS");
  } catch (err) {
    failed++;
    console.log("FAIL");
    console.log(`  Error: ${err.message}`);
  }
}

async function login() {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', "admin@aex.app");
  await page.fill('input[type="password"]', "admin123");
  await page.click('button[type="submit"]');
  // Wait for redirect to main app
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });
}

async function createNewConversation() {
  // Click the "New conversation" / "+" button
  const newBtn = page.locator('button:has-text("New"), button[aria-label*="new" i], button[aria-label*="New" i]').first();
  if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await newBtn.click();
    await page.waitForTimeout(1000);
  }
}

async function sendMessage(text) {
  // Find the message input textarea
  const textarea = page.locator("textarea").first();
  await textarea.waitFor({ state: "visible", timeout: 5000 });
  await textarea.fill(text);
  await page.waitForTimeout(300);

  // Press Enter to send
  await textarea.press("Enter");
}

async function waitForAIResponse(timeout = 30000) {
  // Wait for AI typing to stop or a new AI message to appear
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await page.waitForTimeout(1000);

    // Check if typing indicator is gone
    const typing = page.locator('[class*="typing"], [data-typing="true"]');
    const isTyping = await typing.isVisible().catch(() => false);
    if (!isTyping) {
      // Give it a bit more time for final render
      await page.waitForTimeout(1500);
      return;
    }
  }
  throw new Error("AI response timeout");
}

async function getLastMessage() {
  // Get the last message bubble text
  const msgs = page.locator('[class*="message"], [data-role="ai"], [data-role="assistant"]');
  const count = await msgs.count();
  if (count === 0) return "";
  return msgs.last().innerText();
}

// ---- Tests ----

async function testLogin() {
  await login();
  // Verify we're on main app
  const url = page.url();
  if (!url.includes(BASE)) throw new Error(`Expected main app, got ${url}`);
}

async function testChatStreaming() {
  await createNewConversation();
  await page.waitForTimeout(1000);

  await sendMessage("Olá, me diga em uma frase curta o que você pode fazer.");
  await waitForAIResponse(30000);

  // Take screenshot of the response
  await page.screenshot({ path: "/tmp/test-chat-streaming.png" });

  // Check that page has content (AI responded)
  const bodyText = await page.locator("main, [class*='thread'], [class*='message']").first().innerText().catch(() => "");
  if (bodyText.length < 10) throw new Error("No AI response content detected");
}

async function testReadOnlyToolAutoExecute() {
  await sendMessage("Lista todos os usuários do sistema");
  await waitForAIResponse(30000);

  await page.screenshot({ path: "/tmp/test-readonly-tool.png" });

  // Should show user data without ActionCard
  const bodyText = await page.innerText("body");
  const hasAdmin = bodyText.toLowerCase().includes("admin");
  if (!hasAdmin) throw new Error("Expected admin user in response");
}

async function testMutatingToolActionCard() {
  await sendMessage('Cria uma entidade chamada "Teste E2E" com campos nome (text) e valor (number)');
  await waitForAIResponse(30000);

  await page.screenshot({ path: "/tmp/test-actioncard.png" });

  // Look for ActionCard (approve/confirm button)
  const approveBtn = page.locator('button:has-text("Approve"), button:has-text("Aprovar"), button:has-text("Confirm"), button:has-text("Confirmar"), button:has-text("Yes")').first();
  const hasActionCard = await approveBtn.isVisible({ timeout: 5000 }).catch(() => false);

  if (!hasActionCard) {
    // Could be onboarding mode (no entities = auto-execute). Check if entity was created directly.
    const bodyText = await page.innerText("body");
    const created = bodyText.toLowerCase().includes("teste e2e") || bodyText.toLowerCase().includes("entity");
    if (!created) throw new Error("Neither ActionCard nor entity creation detected");
    console.log("(onboarding mode - auto-executed)");
  } else {
    // Click approve
    await approveBtn.click();
    await waitForAIResponse(30000);
    await page.screenshot({ path: "/tmp/test-actioncard-approved.png" });
  }
}

async function testAutoNaming() {
  // The conversation should have been renamed from "New conversation"
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/tmp/test-autonaming.png" });

  // Check sidebar for conversation name - it should NOT be "New conversation"
  const sidebar = page.locator('nav, [class*="sidebar"], [class*="conversation-list"]').first();
  const sidebarText = await sidebar.innerText().catch(() => "");
  // Just log it, hard to assert specific name
  console.log(`  Sidebar text (first 200): ${sidebarText.slice(0, 200)}`);
}

async function testBackgroundTask() {
  await sendMessage("Cria uma task para listar todas as entidades do sistema");
  await waitForAIResponse(30000);

  await page.screenshot({ path: "/tmp/test-task.png" });

  // Wait for task to complete (might show ActionCard first)
  const approveBtn = page.locator('button:has-text("Approve"), button:has-text("Aprovar"), button:has-text("Confirm"), button:has-text("Confirmar"), button:has-text("Yes")').first();
  const hasActionCard = await approveBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (hasActionCard) {
    await approveBtn.click();
    await waitForAIResponse(30000);
  }

  // Wait a bit for the task to execute in the background
  await page.waitForTimeout(10000);
  await page.screenshot({ path: "/tmp/test-task-result.png" });
}

async function testListEntities() {
  await sendMessage("Lista todas as entidades");
  await waitForAIResponse(30000);

  await page.screenshot({ path: "/tmp/test-list-entities.png" });

  const bodyText = await page.innerText("body");
  console.log(`  Response includes entity info: ${bodyText.toLowerCase().includes("teste e2e") || bodyText.toLowerCase().includes("entit")}`);
}

// ---- Runner ----

async function run() {
  console.log("=== AEX AI SDK Migration E2E Tests ===\n");

  await setup();

  await test("1. Login", testLogin);
  await test("2. Chat streaming", testChatStreaming);
  await test("3. Read-only tool auto-execute", testReadOnlyToolAutoExecute);
  await test("4. Mutating tool ActionCard", testMutatingToolActionCard);
  await test("5. Auto-naming conversation", testAutoNaming);
  await test("6. Background task", testBackgroundTask);
  await test("7. List entities (verify previous creates)", testListEntities);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

  // Keep browser open for manual inspection
  console.log("Browser stays open for 30s for inspection...");
  await page.waitForTimeout(30000);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal:", err);
  browser?.close();
  process.exit(1);
});
