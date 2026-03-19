import { describe, it, expect } from "vitest";
import { sanitizeToolName, propsToJsonSchema } from "./piece-to-tool.js";

const OPENAI_NAME_RE = /^[a-zA-Z0-9_-]+$/;

describe("sanitizeToolName", () => {
  it("strips npm scope and piece- prefix", () => {
    expect(sanitizeToolName("@activepieces/piece-vtex_get-product")).toBe(
      "vtex_get-product",
    );
  });

  it("replaces colon with underscore", () => {
    expect(sanitizeToolName("vtex:get-product-by-id")).toBe(
      "vtex_get-product-by-id",
    );
  });

  it("replaces dots and slashes", () => {
    expect(sanitizeToolName("google.sheets/read_rows")).toBe(
      "google_sheets_read_rows",
    );
  });

  it("keeps valid chars untouched", () => {
    expect(sanitizeToolName("slack_send-message")).toBe("slack_send-message");
  });

  it("always produces OpenAI-valid names", () => {
    const names = [
      "@activepieces/piece-google-sheets_read_rows",
      "@activepieces/piece-slack_send.message",
      "vtex:custom_api_call",
      "hubspot:create-contact",
      "@activepieces/piece-telegram-bot_send_text",
    ];
    for (const name of names) {
      const sanitized = sanitizeToolName(name);
      expect(sanitized).toMatch(OPENAI_NAME_RE);
    }
  });
});

describe("propsToJsonSchema", () => {
  it("returns valid object schema for empty props", () => {
    const schema = propsToJsonSchema({});
    expect(schema).toEqual({ type: "object", properties: {} });
  });

  it("maps SHORT_TEXT to string", () => {
    const schema = propsToJsonSchema({
      name: { type: "SHORT_TEXT", required: true, description: "The name" },
    });
    expect(schema).toEqual({
      type: "object",
      properties: { name: { type: "string", description: "The name" } },
      required: ["name"],
    });
  });

  it("maps NUMBER to number", () => {
    const schema = propsToJsonSchema({
      count: { type: "NUMBER", required: true, description: "Count" },
    });
    expect(schema.properties).toEqual({
      count: { type: "number", description: "Count" },
    });
  });

  it("maps CHECKBOX to boolean", () => {
    const schema = propsToJsonSchema({
      active: { type: "CHECKBOX", description: "Is active" },
    });
    expect((schema.properties as Record<string, unknown>).active).toEqual({
      type: "boolean",
      description: "Is active",
    });
  });

  it("maps ARRAY with items (OpenAI requirement)", () => {
    const schema = propsToJsonSchema({
      tags: { type: "ARRAY", description: "Tags" },
    });
    expect((schema.properties as Record<string, unknown>).tags).toEqual({
      type: "array",
      items: { type: "string" },
      description: "Tags",
    });
  });

  it("maps MULTI_SELECT_DROPDOWN with items", () => {
    const schema = propsToJsonSchema({
      choices: { type: "MULTI_SELECT_DROPDOWN", description: "Choices" },
    });
    const prop = (schema.properties as Record<string, unknown>).choices as Record<string, unknown>;
    expect(prop.type).toBe("array");
    expect(prop.items).toEqual({ type: "string" });
  });

  it("maps OBJECT with additionalProperties", () => {
    const schema = propsToJsonSchema({
      data: { type: "OBJECT", description: "Payload" },
    });
    expect((schema.properties as Record<string, unknown>).data).toEqual({
      type: "object",
      additionalProperties: true,
      description: "Payload",
    });
  });

  it("maps DYNAMIC to object", () => {
    const schema = propsToJsonSchema({
      body: { type: "DYNAMIC", description: "Body" },
    });
    const prop = (schema.properties as Record<string, unknown>).body as Record<string, unknown>;
    expect(prop.type).toBe("object");
    expect(prop.additionalProperties).toBe(true);
  });

  it("maps DROPDOWN/STATIC_DROPDOWN to string", () => {
    const schema = propsToJsonSchema({
      method: { type: "STATIC_DROPDOWN", description: "Method" },
      channel: { type: "DROPDOWN", description: "Channel" },
    });
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.method.type).toBe("string");
    expect(props.channel.type).toBe("string");
  });

  it("falls back to string for unknown types", () => {
    const schema = propsToJsonSchema({
      field: { type: "SOME_FUTURE_TYPE", description: "Unknown" },
    });
    const prop = (schema.properties as Record<string, unknown>).field as Record<string, unknown>;
    expect(prop.type).toBe("string");
  });

  it("uses displayName as fallback description", () => {
    const schema = propsToJsonSchema({
      name: { type: "SHORT_TEXT", displayName: "Full Name" },
    });
    const prop = (schema.properties as Record<string, unknown>).name as Record<string, unknown>;
    expect(prop.description).toBe("Full Name");
  });

  it("only includes required for required fields", () => {
    const schema = propsToJsonSchema({
      a: { type: "SHORT_TEXT", required: true },
      b: { type: "SHORT_TEXT", required: false },
      c: { type: "SHORT_TEXT" },
    });
    expect(schema.required).toEqual(["a"]);
  });

  it("omits required array when no required fields", () => {
    const schema = propsToJsonSchema({
      a: { type: "SHORT_TEXT" },
    });
    expect(schema).not.toHaveProperty("required");
  });

  it("skips null/undefined props", () => {
    const schema = propsToJsonSchema({
      a: null,
      b: undefined,
      c: { type: "NUMBER" },
    });
    const props = schema.properties as Record<string, unknown>;
    expect(Object.keys(props)).toEqual(["c"]);
  });

  it("always produces type:object at root (OpenAI requirement)", () => {
    const cases = [
      {},
      { x: { type: "NUMBER" } },
      { x: null, y: undefined },
    ];
    for (const props of cases) {
      const schema = propsToJsonSchema(props);
      expect(schema.type).toBe("object");
      expect(schema).toHaveProperty("properties");
    }
  });
});
