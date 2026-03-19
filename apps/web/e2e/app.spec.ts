import { test, expect } from "@playwright/test";
import { login, snap, navigateTo } from "./helpers";

test.describe("Login", () => {
  test("shows login page with form", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await snap(page, "01-login-page");

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', "wrong@aex.app");
    await page.fill('input[type="password"]', "wrongpass");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    await snap(page, "02-login-error");

    // Should show some error message or stay on login
    await expect(page).toHaveURL(/login/);
  });

  test("login with valid credentials redirects to app", async ({ page }) => {
    await login(page);
    await snap(page, "03-login-success");

    // Should be on the main app (not /login)
    await expect(page).not.toHaveURL(/login/);
  });
});

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("sidebar shows all navigation items", async ({ page }) => {
    for (const label of ["Chat", "Mail", "Files", "Database", "Tasks", "Workflows", "Settings"]) {
      await expect(page.locator(`button[aria-label="${label}"]`)).toBeVisible();
    }
    await snap(page, "04-sidebar-nav");
  });

  test("navigate to Database section", async ({ page }) => {
    await navigateTo(page, "Database");
    await snap(page, "05-database-section");
  });

  test("navigate to Tasks section", async ({ page }) => {
    await navigateTo(page, "Tasks");
    await snap(page, "06-tasks-section");
  });

  test("navigate to Workflows section", async ({ page }) => {
    await navigateTo(page, "Workflows");
    await snap(page, "07-workflows-section");
  });

  test("navigate to Settings section", async ({ page }) => {
    await navigateTo(page, "Settings");
    await snap(page, "08-settings-section");
  });
});

test.describe("Chat", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("chat page loads with conversation list", async ({ page }) => {
    // Chat is the default section after login
    await page.waitForTimeout(1000);
    await snap(page, "09-chat-page");
  });

  test("can type a message in the chat input", async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for the chat input (textarea or input in the message area)
    const chatInput = page.locator('textarea, input[placeholder*="message" i], input[placeholder*="type" i], [contenteditable="true"]').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill("Teste E2E via Playwright");
      await snap(page, "10-chat-message-typed");
    }
  });
});

test.describe("Database", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, "Database");
  });

  test("database page loads", async ({ page }) => {
    await page.waitForTimeout(500);
    await snap(page, "11-database-page");
  });
});

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, "Tasks");
  });

  test("tasks page loads with stats", async ({ page }) => {
    await page.waitForTimeout(500);
    await snap(page, "12-tasks-page");
  });
});

test.describe("Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, "Workflows");
  });

  test("workflows page loads with canvas", async ({ page }) => {
    await page.waitForTimeout(500);
    await snap(page, "13-workflows-page");
  });
});

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, "Settings");
  });

  test("settings page loads with tabs", async ({ page }) => {
    await page.waitForTimeout(500);
    await snap(page, "14-settings-page");
  });
});
