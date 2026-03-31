import { Worker } from "bullmq";
import { readFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import { redisConnection } from "./connection.js";
import type { FileIndexingJobData } from "./file-indexing-queue.js";

/** Split text into chunks with overlap */
function chunkText(
  text: string,
  chunkSize: number,
  overlap: number,
): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

async function extractText(
  filePath: string,
  mimeType: string | null,
): Promise<string | null> {
  const mime = mimeType || "";

  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/csv" ||
    mime === "text/csv"
  ) {
    const buffer = await readFile(filePath, "utf-8");
    return buffer;
  }

  if (mime === "application/pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const buffer = await readFile(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    } catch (err) {
      console.warn("[file-indexing] PDF parsing failed:", err);
      return null;
    }
  }

  console.warn(
    `[file-indexing] Unsupported mime type: ${mime}, skipping extraction`,
  );
  return null;
}

export function startFileIndexingWorker() {
  const worker = new Worker(
    "file-indexing",
    async (job) => {
      const { fileId, userId, action } = job.data as FileIndexingJobData;
      const { db } = await import("../db/index.js");
      const { files, knowledge } = await import("../db/schema/index.js");
      const { generateEmbeddingsBatch } = await import(
        "../ai/embedding-service.js"
      );

      if (action === "deindex") {
        await db
          .delete(knowledge)
          .where(eq(knowledge.sourceFileId, fileId));
        console.log(`[file-indexing] De-indexed file ${fileId}`);
        return;
      }

      // action === "index"
      const [file] = await db
        .select({
          id: files.id,
          name: files.name,
          path: files.path,
          mimeType: files.mimeType,
        })
        .from(files)
        .where(eq(files.id, fileId))
        .limit(1);

      if (!file || !file.path) {
        console.warn(`[file-indexing] File ${fileId} not found or has no path`);
        return;
      }

      const text = await extractText(file.path, file.mimeType);
      if (!text || text.trim().length === 0) {
        console.warn(
          `[file-indexing] No text extracted from file ${fileId} (${file.mimeType})`,
        );
        // Mark as not indexed
        await db
          .update(files)
          .set({ aiIndexed: 0 })
          .where(eq(files.id, fileId));
        return;
      }

      // Remove existing knowledge entries for this file before re-indexing
      await db
        .delete(knowledge)
        .where(eq(knowledge.sourceFileId, fileId));

      const chunks = chunkText(text, 3000, 100);
      console.log(
        `[file-indexing] Processing ${chunks.length} chunks for file ${file.name}`,
      );

      // Process in batches of 8
      const BATCH_SIZE = 8;
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const embeddings = await generateEmbeddingsBatch(batch);

        for (let j = 0; j < batch.length; j++) {
          const chunkIndex = i + j;
          const id = crypto.randomUUID();
          const title = `${file.name} (chunk ${chunkIndex + 1}/${chunks.length})`;

          await db.insert(knowledge).values({
            id,
            scope: "company",
            category: "file-content",
            title,
            content: batch[j],
            createdBy: userId,
            sourceFileId: fileId,
          });

          // Update embedding if available
          const emb = embeddings[j];
          if (emb) {
            const vectorLiteral = sql`'[${sql.raw(emb.join(","))}]'::vector`;
            await db.execute(
              sql`UPDATE knowledge SET embedding = ${vectorLiteral} WHERE id = ${id}`,
            );
          }
        }
      }

      console.log(
        `[file-indexing] Indexed file ${file.name} (${chunks.length} chunks)`,
      );
    },
    {
      connection: redisConnection,
      concurrency: 2,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[file-indexing] Job ${job?.id} failed:`, err.message);
  });

  console.log("[file-indexing] Worker started");
  return worker;
}
