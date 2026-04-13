import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, or, sql } from "drizzle-orm";
import { auth } from "../auth/index.js";
import { localStorage, getFileType, getMimeType, formatFileSize, UPLOADS_DIR } from "../files/storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerUploadRoutes(app: FastifyInstance) {
  app.post("/api/upload/audio", async (req, reply) => {
    // Authenticate via cookie
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const ext = data.filename?.split(".").pop() || "webm";
    const filename = `${randomUUID()}.${ext}`;
    const filepath = resolve(UPLOADS_DIR, filename);

    await mkdir(UPLOADS_DIR, { recursive: true });
    const buffer = await data.toBuffer();
    await writeFile(filepath, buffer);

    // Calculate basic duration estimate from file size (rough heuristic)
    // For proper duration, the client should send it as form field
    const durationField = data.fields?.duration;
    const duration = durationField && typeof durationField === "object" && "value" in durationField
      ? (durationField as { value: string }).value
      : "0:00";

    const waveformField = data.fields?.waveform;
    let waveform: number[] | undefined;
    if (waveformField && typeof waveformField === "object" && "value" in waveformField) {
      try {
        waveform = JSON.parse((waveformField as { value: string }).value);
      } catch {
        // skip
      }
    }

    const url = `/uploads/${filename}`;

    return reply.send({
      url,
      duration,
      waveform,
      transcription: undefined,
    });
  });

  // File upload
  app.post("/api/upload/file", async (req, reply) => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const buffer = await data.toBuffer();
    const originalName = data.filename || "unnamed";
    const relativePath = await localStorage.saveFile(buffer, originalName);
    const fileType = getFileType(originalName);
    const mimeType = getMimeType(originalName);

    // Get optional parentId from form fields
    const parentIdField = data.fields?.parentId;
    const parentId = parentIdField && typeof parentIdField === "object" && "value" in parentIdField
      ? (parentIdField as { value: string }).value || null
      : null;

    const { db } = await import("../db/index.js");
    const { files } = await import("../db/schema/index.js");

    const id = randomUUID();
    const [file] = await db
      .insert(files)
      .values({
        id,
        name: originalName,
        type: fileType,
        mimeType,
        size: buffer.length,
        path: relativePath,
        source: "upload",
        ownerId: session.user.id,
        parentId,
      })
      .returning();

    const { broadcast } = await import("../ws/index.js");
    broadcast({ type: "file_updated" });

    return reply.send({
      id: file.id,
      name: file.name,
      type: file.type,
      size: formatFileSize(buffer.length),
      mimeType,
      path: relativePath,
    });
  });

  // File download (authenticated + owner/share ACL)
  app.get("/api/files/:id/download", async (req, reply) => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = req.params as { id: string };
    const { db } = await import("../db/index.js");
    const { files, fileShares } = await import("../db/schema/index.js");
    const userId = session.user.id;

    // Authorize: requester must own the file or have a share granting access.
    const [file] = await db
      .select()
      .from(files)
      .where(and(
        eq(files.id, id),
        or(
          eq(files.ownerId, userId),
          sql`EXISTS (SELECT 1 FROM ${fileShares} WHERE ${fileShares.fileId} = ${id} AND ${fileShares.userId} = ${userId})`,
        ),
      ))
      .limit(1);

    if (!file || !file.path) {
      // 404 rather than 403 so we don't leak existence of files the user can't access.
      return reply.status(404).send({ error: "File not found" });
    }

    const { readFile } = await import("node:fs/promises");
    try {
      const absolutePath = localStorage.getFilePath(file.path);
      const data = await readFile(absolutePath);
      reply.header("Content-Type", file.mimeType || "application/octet-stream");
      reply.header("Content-Disposition", `attachment; filename="${file.name}"`);
      return reply.send(data);
    } catch {
      return reply.status(404).send({ error: "File not found on disk" });
    }
  });

  // Public file download (no auth, via public token)
  app.get("/api/files/public/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const { db } = await import("../db/index.js");
    const { files } = await import("../db/schema/index.js");

    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.publicToken, token))
      .limit(1);

    if (!file || !file.path) {
      return reply.status(404).send({ error: "File not found" });
    }

    const { readFile } = await import("node:fs/promises");
    try {
      const absolutePath = localStorage.getFilePath(file.path);
      const data = await readFile(absolutePath);
      reply.header("Content-Type", file.mimeType || "application/octet-stream");
      reply.header("Content-Disposition", `attachment; filename="${file.name}"`);
      return reply.send(data);
    } catch {
      return reply.status(404).send({ error: "File not found on disk" });
    }
  });

  // Serve uploaded files
  app.get("/uploads/:filename", async (req, reply) => {
    const { filename } = req.params as { filename: string };
    // Prevent path traversal
    if (filename.includes("..") || filename.includes("/")) {
      return reply.status(400).send({ error: "Invalid filename" });
    }

    const filepath = resolve(UPLOADS_DIR, filename);
    const { readFile } = await import("node:fs/promises");

    try {
      const data = await readFile(filepath);
      const ext = filename.split(".").pop();
      const mimeMap: Record<string, string> = {
        webm: "audio/webm",
        mp3: "audio/mpeg",
        ogg: "audio/ogg",
        wav: "audio/wav",
        m4a: "audio/mp4",
        pdf: "application/pdf",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
        webp: "image/webp",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        csv: "text/csv",
        txt: "text/plain",
        json: "application/json",
        zip: "application/zip",
      };
      reply.header("Content-Type", mimeMap[ext || ""] || "application/octet-stream");
      return reply.send(data);
    } catch {
      return reply.status(404).send({ error: "File not found" });
    }
  });
}
