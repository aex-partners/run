import { describe, it, expect } from "vitest";
import { slugify, parseFields, serializeFields, validateFieldType, validateRecordData, type EntityField } from "./entity-fields.js";

describe("slugify edge cases", () => {
  it("returns fallback field_XXXX for all-emoji input", () => {
    const result = slugify("🔥🚀");
    expect(result).toMatch(/^field_[a-f0-9]{8}$/);
  });

  it("handles CJK characters with fallback", () => {
    const result = slugify("产品名称");
    expect(result).toMatch(/^field_[a-f0-9]{8}$/);
  });

  it("handles mixed ASCII and accents", () => {
    expect(slugify("São Paulo - Capital")).toBe("sao_paulo_capital");
  });

  it("handles single character", () => {
    expect(slugify("A")).toBe("a");
  });

  it("returns fallback field_XXXX for empty string", () => {
    const result = slugify("");
    expect(result).toMatch(/^field_[a-f0-9]{8}$/);
  });
});

describe("parseFields", () => {
  it("returns empty array on invalid JSON", () => {
    expect(parseFields("not json")).toEqual([]);
  });

  it("returns empty array on empty string", () => {
    expect(parseFields("")).toEqual([]);
  });

  it("parses valid JSON", () => {
    const fields: EntityField[] = [{ id: "1", name: "Nome", slug: "nome", type: "text", required: true }];
    expect(parseFields(JSON.stringify(fields))).toEqual(fields);
  });
});

describe("serializeFields", () => {
  it("roundtrips with parseFields", () => {
    const fields: EntityField[] = [
      { id: "1", name: "Nome", slug: "nome", type: "text", required: true },
      { id: "2", name: "Status", slug: "status", type: "select", required: false, options: [{ value: "A", label: "A" }, { value: "B", label: "B" }] },
    ];
    const result = parseFields(serializeFields(fields));
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Nome");
    expect(result[0].options).toBeUndefined();
    expect(result[1].name).toBe("Status");
    expect(result[1].options).toEqual([{ value: "A", label: "A" }, { value: "B", label: "B" }]);
  });
});

describe("validateFieldType", () => {
  it("accepts all valid types", () => {
    for (const t of ["text", "number", "email", "phone", "date", "select", "checkbox"]) {
      expect(validateFieldType(t)).toBe(true);
    }
  });

  it("rejects invalid types", () => {
    expect(validateFieldType("invalid")).toBe(false);
    expect(validateFieldType("")).toBe(false);
    expect(validateFieldType("TEXT")).toBe(false);
  });
});

describe("validateRecordData edge cases", () => {
  const fields: EntityField[] = [
    { id: "1", name: "Nome", slug: "nome", type: "text", required: true },
    { id: "2", name: "Ativo", slug: "ativo", type: "checkbox", required: false },
  ];

  it("accepts boolean true/false for checkbox", () => {
    expect(validateRecordData({ nome: "X", ativo: true }, fields).valid).toBe(true);
    expect(validateRecordData({ nome: "X", ativo: false }, fields).valid).toBe(true);
  });

  it("accepts string 'true'/'false' for checkbox", () => {
    expect(validateRecordData({ nome: "X", ativo: "true" }, fields).valid).toBe(true);
    expect(validateRecordData({ nome: "X", ativo: "false" }, fields).valid).toBe(true);
  });

  it("rejects non-boolean for checkbox", () => {
    const result = validateRecordData({ nome: "X", ativo: "maybe" }, fields);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("boolean");
  });

  it("ignores unknown fields silently", () => {
    const result = validateRecordData({ nome: "X", campo_fantasma: "value" }, fields);
    expect(result.valid).toBe(true);
  });

  it("skips type check for null/undefined/empty values", () => {
    const result = validateRecordData({ nome: "X", ativo: null }, fields);
    expect(result.valid).toBe(true);
  });

  it("rejects missing required when value is undefined", () => {
    const result = validateRecordData({}, fields);
    expect(result.valid).toBe(false);
  });
});
