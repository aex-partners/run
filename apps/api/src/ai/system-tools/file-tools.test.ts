import { describe, it, expect } from "vitest";
import PDFDocument from "pdfkit";
import { marked } from "marked";

// Mirrors the renderer used by the generate_pdf tool. Kept here to give the
// PDF path a fast, infra-free sanity check before the tool is exercised in a
// full chat integration run.
async function renderPdf(title: string, markdown: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font("Helvetica-Bold").fontSize(18).text(title);
  doc.font("Helvetica").fontSize(11);
  const tokens = marked.lexer(markdown);
  for (const t of tokens) {
    if (t.type === "paragraph") doc.text((t as { text: string }).text);
    if (t.type === "heading") {
      doc.font("Helvetica-Bold").fontSize(14).text((t as { text: string }).text);
      doc.font("Helvetica").fontSize(11);
    }
  }
  doc.end();
  return done;
}

describe("pdf renderer", () => {
  it("produces a PDF with the %PDF- header and non-trivial size", async () => {
    const buf = await renderPdf("Pedido de Venda", "## Cliente\n\nBarbara Locatelli\n\nTotal: R$ 2.698,56");
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("handles empty markdown body without crashing", async () => {
    const buf = await renderPdf("Empty", "");
    expect(buf.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
