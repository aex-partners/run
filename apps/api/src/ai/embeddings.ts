import { embed } from "ai";
import { sql } from "drizzle-orm";
import { getProvider } from "./client.js";
import { messageEmbeddings } from "../db/schema/index.js";
import type { Database } from "../db/index.js";

const EMBEDDING_MODEL = "text-embedding-3-small";

async function getEmbeddingModel() {
  const provider = await getProvider();
  return provider.embedding(EMBEDDING_MODEL);
}

export async function generateAndStoreEmbedding(
  messageId: string,
  conversationId: string,
  content: string,
  role: string,
  db: Database,
): Promise<void> {
  if (!content.trim()) return;

  try {
    const model = await getEmbeddingModel();
    const { embedding } = await embed({ model, value: content });

    await db.insert(messageEmbeddings).values({
      id: crypto.randomUUID(),
      messageId,
      conversationId,
      content,
      role,
      embedding,
    });
  } catch (err) {
    console.error("Embedding generation failed:", err);
  }
}

export async function searchSimilarMessages(
  query: string,
  db: Database,
  options: {
    conversationId?: string;
    limit?: number;
  } = {},
): Promise<Array<{ content: string; role: string; conversationId: string; similarity: number }>> {
  const { limit = 10 } = options;

  try {
    const model = await getEmbeddingModel();
    const { embedding } = await embed({ model, value: query });

    const vectorStr = `[${embedding.join(",")}]`;

    const conversationFilter = options.conversationId
      ? sql`AND ${messageEmbeddings.conversationId} = ${options.conversationId}`
      : sql``;

    const results = await db.execute<{
      content: string;
      role: string;
      conversation_id: string;
      similarity: number;
    }>(sql`
      SELECT
        ${messageEmbeddings.content},
        ${messageEmbeddings.role},
        ${messageEmbeddings.conversationId},
        1 - (${messageEmbeddings.embedding} <=> ${vectorStr}::vector) as similarity
      FROM ${messageEmbeddings}
      WHERE 1=1 ${conversationFilter}
      ORDER BY ${messageEmbeddings.embedding} <=> ${vectorStr}::vector
      LIMIT ${limit}
    `);

    return results.rows.map((r) => ({
      content: r.content,
      role: r.role,
      conversationId: r.conversation_id,
      similarity: r.similarity,
    }));
  } catch (err) {
    console.error("Similarity search failed:", err);
    return [];
  }
}
