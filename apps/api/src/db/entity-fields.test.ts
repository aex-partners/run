import { describe, it, expect } from "vitest";
import { slugify, validateRecordData, type EntityField } from "./entity-fields.js";

describe("slugify", () => {
  it("handles Portuguese accents", () => {
    expect(slugify("Camiseta Básica")).toBe("camiseta_basica");
  });

  it("handles special characters", () => {
    expect(slugify("Preço (R$)")).toBe("preco_r");
  });

  it("strips leading/trailing underscores", () => {
    expect(slugify("_hello_")).toBe("hello");
  });

  it("collapses multiple separators", () => {
    expect(slugify("foo---bar   baz")).toBe("foo_bar_baz");
  });
});

describe("validateRecordData", () => {
  const fields: EntityField[] = [
    { id: "1", name: "Nome", slug: "nome", type: "text", required: true },
    { id: "2", name: "Email", slug: "email", type: "email", required: false },
    { id: "3", name: "Categoria", slug: "categoria", type: "select", required: false, options: ["A", "B", "C"] },
    { id: "4", name: "Quantidade", slug: "quantidade", type: "number", required: false },
  ];

  it("rejects empty required field", () => {
    const result = validateRecordData({ nome: "" }, fields);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Nome");
  });

  it("validates email format", () => {
    const result = validateRecordData({ nome: "Test", email: "invalid" }, fields);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("email");
  });

  it("validates select options", () => {
    const result = validateRecordData({ nome: "Test", categoria: "X" }, fields);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Categoria");
  });

  it("accepts partial=true without required check", () => {
    const result = validateRecordData({ email: "a@b.com" }, fields, true);
    expect(result.valid).toBe(true);
  });

  it("accepts number as string", () => {
    const result = validateRecordData({ nome: "Test", quantidade: "42" }, fields);
    expect(result.valid).toBe(true);
  });

  it("rejects non-numeric string for number field", () => {
    const result = validateRecordData({ nome: "Test", quantidade: "abc" }, fields);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("number");
  });

  it("accepts valid complete data", () => {
    const result = validateRecordData(
      { nome: "Test", email: "a@b.com", categoria: "A", quantidade: 10 },
      fields,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
