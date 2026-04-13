import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { marked, type Tokens } from "marked";
import PDFDocument from "pdfkit";
import type { ToolContext } from "../types.js";
import { files, fileShares } from "../../db/schema/index.js";
import { localStorage, getMimeType } from "../../files/storage.js";
import { enqueueEmail } from "../../queue/email-queue.js";
import { getDefaultAccountForUser, userCanSendFrom } from "../../email/provider.js";
import { emailAccounts } from "../../db/schema/index.js";

function slugifyFilename(input: string, ext: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return `${base || "document"}${ext}`;
}

async function renderMarkdownToPdf(title: string, markdown: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font("Helvetica-Bold").fontSize(18).text(title);
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(11);

  const tokens = marked.lexer(markdown);
  renderTokens(doc, tokens);

  doc.end();
  return done;
}

function renderTokens(doc: PDFKit.PDFDocument, tokens: Tokens.Generic[]): void {
  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const t = token as Tokens.Heading;
        const sizes: Record<number, number> = { 1: 16, 2: 14, 3: 12, 4: 11, 5: 11, 6: 11 };
        doc.moveDown(0.4);
        doc.font("Helvetica-Bold").fontSize(sizes[t.depth] ?? 12).text(t.text);
        doc.font("Helvetica").fontSize(11);
        doc.moveDown(0.2);
        break;
      }
      case "paragraph": {
        const t = token as Tokens.Paragraph;
        doc.font("Helvetica").fontSize(11).text(t.text, { align: "left" });
        doc.moveDown(0.4);
        break;
      }
      case "list": {
        const t = token as Tokens.List;
        const startNum = typeof t.start === "number" ? t.start : 1;
        t.items.forEach((item, i) => {
          const bullet = t.ordered ? `${startNum + i}.` : "•";
          doc.font("Helvetica").fontSize(11).text(`${bullet} ${item.text}`, { indent: 12 });
        });
        doc.moveDown(0.3);
        break;
      }
      case "table": {
        renderTable(doc, token as Tokens.Table);
        break;
      }
      case "hr": {
        const y = doc.y;
        doc.moveTo(48, y).lineTo(doc.page.width - 48, y).stroke();
        doc.moveDown(0.4);
        break;
      }
      case "code": {
        const t = token as Tokens.Code;
        doc.font("Courier").fontSize(10).text(t.text, { indent: 8 });
        doc.font("Helvetica").fontSize(11);
        doc.moveDown(0.4);
        break;
      }
      case "space": {
        doc.moveDown(0.3);
        break;
      }
      default: {
        // Fall back to raw text so uncommon token types still render something.
        const raw = (token as { raw?: string }).raw;
        if (raw) {
          doc.font("Helvetica").fontSize(11).text(raw);
          doc.moveDown(0.3);
        }
      }
    }
  }
}

function renderTable(doc: PDFKit.PDFDocument, table: Tokens.Table): void {
  const pageWidth = doc.page.width - 48 * 2;
  const colCount = table.header.length || 1;
  const colWidth = pageWidth / colCount;
  const rowHeight = 18;
  const startX = 48;

  doc.font("Helvetica-Bold").fontSize(10);
  let y = doc.y;
  table.header.forEach((cell, i) => {
    doc.text(cell.text, startX + i * colWidth, y, { width: colWidth - 4, ellipsis: true });
  });
  y += rowHeight;
  doc.moveTo(startX, y - 2).lineTo(startX + pageWidth, y - 2).stroke();

  doc.font("Helvetica").fontSize(10);
  for (const row of table.rows) {
    if (y + rowHeight > doc.page.height - 48) {
      doc.addPage();
      y = doc.y;
    }
    row.forEach((cell, i) => {
      doc.text(cell.text, startX + i * colWidth, y, { width: colWidth - 4, ellipsis: true });
    });
    y += rowHeight;
  }
  doc.font("Helvetica").fontSize(11);
  doc.y = y + 4;
}

async function loadAttachmentFiles(ctx: ToolContext, fileIds: string[]) {
  if (fileIds.length === 0) return [];
  const rows = await ctx.db
    .select()
    .from(files)
    .where(inArray(files.id, fileIds));

  const accessible = rows.filter((f) => {
    if (f.ownerId === ctx.userId) return true;
    return false;
  });

  const ownerOnly = new Set(accessible.map((f) => f.id));
  const missing = fileIds.filter((id) => !ownerOnly.has(id));

  if (missing.length > 0) {
    // Surface any non-owner files via share check in a single query.
    const shareRows = await ctx.db
      .select({ fileId: fileShares.fileId })
      .from(fileShares)
      .where(and(eq(fileShares.userId, ctx.userId), inArray(fileShares.fileId, missing)));
    const shared = new Set(shareRows.map((s) => s.fileId));
    for (const row of rows) {
      if (shared.has(row.id) && !ownerOnly.has(row.id)) accessible.push(row);
    }
  }

  return accessible.map((f) => ({
    filename: f.name,
    path: f.path ? localStorage.getFilePath(f.path) : "",
    contentType: f.mimeType ?? undefined,
  })).filter((a) => a.path);
}

export function buildFileTools(ctx: ToolContext) {
  return [
    tool(
      "generate_pdf",
      "Generate a PDF document from markdown content and store it in Files. Supports headings (#, ##, ###), paragraphs, bullet/numbered lists, tables (GitHub-flavored), horizontal rules, and code blocks. Returns the file id and name so the agent can reference or attach it to an email.",
      {
        title: z.string().min(1).describe("Title shown at the top of the PDF and used as the file display name."),
        markdown: z.string().min(1).describe("Document body as markdown."),
        filename: z.string().optional().describe("Optional filename override (extension will always be .pdf)."),
      },
      async ({ title, markdown, filename }) => {
        const buffer = await renderMarkdownToPdf(title, markdown);
        const stored = slugifyFilename(filename ?? title, ".pdf");
        const path = await localStorage.saveFile(buffer, stored);

        const id = randomUUID();
        const displayName = (filename ?? title).endsWith(".pdf")
          ? (filename ?? title)
          : `${filename ?? title}.pdf`;

        await ctx.db.insert(files).values({
          id,
          name: displayName,
          type: "pdf",
          mimeType: "application/pdf",
          size: buffer.length,
          path,
          source: "generated",
          sourceRef: ctx.conversationId,
          ownerId: ctx.userId,
        });

        const downloadPath = `/api/files/${id}/download`;

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              file_id: id,
              name: displayName,
              size_bytes: buffer.length,
              mime_type: "application/pdf",
              download_path: downloadPath,
              note: "Same-origin download. Surface this path as a markdown link in your reply, e.g. [download](" + downloadPath + "), so the user can save the file from chat. Also mention the file appears in the Files panel.",
            }),
          }],
        };
      },
    ),

    tool(
      "send_email",
      "Send an email using the user's default mail account (or a specified one). Accepts HTML or markdown body. Optionally attach files by their file_id (from generate_pdf or upload_file).",
      {
        to: z.array(z.string().email()).min(1).describe("Recipient email addresses."),
        subject: z.string().min(1).describe("Subject line."),
        body: z.string().min(1).describe("Body content. If body_format is 'markdown' it will be converted to HTML; if 'html' it is sent as-is."),
        body_format: z.enum(["markdown", "html"]).optional().describe("How to treat body. Defaults to 'markdown'."),
        cc: z.array(z.string().email()).optional(),
        attachment_file_ids: z.array(z.string()).optional().describe("File IDs (from Files) to attach. The current user must own or have them shared."),
        account_id: z.string().optional().describe("Specific email account to send from. Defaults to the user's primary account."),
      },
      async ({ to, subject, body, body_format, cc, attachment_file_ids, account_id }) => {
        let accountId = account_id;
        if (accountId) {
          const canSend = await userCanSendFrom(ctx.db, ctx.userId, accountId);
          if (!canSend) {
            return { content: [{ type: "text" as const, text: `User cannot send from account ${accountId}` }], isError: true };
          }
        } else {
          const def = await getDefaultAccountForUser(ctx.db, ctx.userId);
          if (!def) {
            return {
              content: [{
                type: "text" as const,
                text: "No email account configured for this user. Ask the user to add one via Settings → Email before sending.",
              }],
              isError: true,
            };
          }
          const [resolved] = await ctx.db
            .select({ id: emailAccounts.id })
            .from(emailAccounts)
            .where(and(eq(emailAccounts.ownerId, ctx.userId), eq(emailAccounts.emailAddress, def.from)))
            .limit(1);
          if (!resolved) {
            return { content: [{ type: "text" as const, text: "Could not resolve default account id" }], isError: true };
          }
          accountId = resolved.id;
        }

        const format = body_format ?? "markdown";
        const bodyHtml = format === "markdown" ? await marked.parse(body) : body;
        const attachments = await loadAttachmentFiles(ctx, attachment_file_ids ?? []);

        await enqueueEmail({
          accountId,
          to,
          cc,
          subject,
          bodyHtml,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            path: a.path,
            contentType: a.contentType ?? getMimeType(a.filename),
          })),
          storeSent: true,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              queued: true,
              to,
              subject,
              attachments: attachments.length,
              account_id: accountId,
            }),
          }],
        };
      },
    ),
  ];
}

