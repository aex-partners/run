import { type Page } from "@playwright/test";
import { join } from "path";

const SCREENSHOT_DIR = join(import.meta.dirname, "screenshots");

export const ADMIN_EMAIL = "admin@aex.app";
export const ADMIN_PASSWORD = "admin123";

export async function login(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // If redirected to setup, the setup is already done; go back to login
  if (page.url().includes("/setup")) {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
  }

  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for navigation away from login (could be / or any non-login page)
  await page.waitForFunction(() => !window.location.pathname.includes("/login"), { timeout: 10000 });
  await page.waitForLoadState("networkidle");

  // Dismiss onboarding tour if present
  await dismissTour(page);
}

/**
 * Dismiss the onboarding tour if it's showing.
 */
export async function dismissTour(page: Page) {
  const skipButton = page.getByText("Skip", { exact: true });
  if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipButton.click();
    await page.waitForTimeout(500);
  }
}

export async function snap(page: Page, name: string) {
  await page.screenshot({
    path: join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: false,
  });
}

/**
 * Navigate via sidebar using aria-label on NavItem buttons.
 * Labels: Chat, Mail, Files, Database, Tasks, Workflows, Settings
 */
export async function navigateTo(page: Page, label: string) {
  await page.locator(`button[aria-label="${label}"]`).click();
  await page.waitForTimeout(800);
}
