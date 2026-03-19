import { describe, it, expect } from "vitest";
import {
  shouldAutoExecute,
  READ_ONLY_TOOLS,
  WORKER_BLOCKED_TOOLS,
  createWorkerTools,
  createTools,
  type ToolContext,
} from "./tools.js";

describe("shouldAutoExecute", () => {
  it("returns true for each READ_ONLY_TOOLS member", () => {
    for (const toolName of READ_ONLY_TOOLS) {
      expect(shouldAutoExecute(toolName, false)).toBe(true);
    }
  });

  it("returns false for mutating tools", () => {
    const mutating = ["insert_record", "create_entity", "delete_record", "update_record", "create_conversation"];
    for (const toolName of mutating) {
      expect(shouldAutoExecute(toolName, false)).toBe(false);
    }
  });

  it("respects customReadOnlyTools", () => {
    const custom = new Set(["my_custom_tool"]);
    expect(shouldAutoExecute("my_custom_tool", false, custom)).toBe(true);
    expect(shouldAutoExecute("my_custom_tool", false)).toBe(false);
  });
});

describe("createWorkerTools", () => {
  const fakeCtx: ToolContext = {
    db: {} as ToolContext["db"],
    userId: "u1",
  };

  it("excludes WORKER_BLOCKED_TOOLS", () => {
    const tools = createWorkerTools(fakeCtx);
    for (const blocked of WORKER_BLOCKED_TOOLS) {
      expect(tools).not.toHaveProperty(blocked);
    }
  });

  it("includes record/entity tools", () => {
    const tools = createWorkerTools(fakeCtx);
    const expected = ["insert_record", "query_records", "update_record", "delete_record", "create_entity"];
    for (const name of expected) {
      expect(tools).toHaveProperty(name);
    }
  });
});
