import { vi } from "vitest";

// This file is imported by tests that need WS mocked.
// Usage: vi.mock("../ws/index.js", () => import("../test/mock-ws.js"));

export const sendToConversation = vi.fn();
export const sendToUser = vi.fn();
export const broadcast = vi.fn();
export const registerWebSocket = vi.fn();
