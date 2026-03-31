// Embedding service using Voyage AI API (voyage-3 model, 1024 dimensions)
// Uses ANTHROPIC_API_KEY as bearer token for Voyage API endpoint

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  return key;
}

interface VoyageResponse {
  data: Array<{ embedding: number[] }>;
}

async function callVoyageAPI(
  input: string[],
  inputType: "document" | "query",
): Promise<VoyageResponse> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input,
      input_type: inputType,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Voyage API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<VoyageResponse>;
}

export async function generateEmbedding(
  text: string,
): Promise<number[] | null> {
  try {
    const response = await callVoyageAPI([text], "document");
    return response.data[0].embedding;
  } catch (err) {
    console.error("Embedding generation failed:", err);
    return null;
  }
}

export async function generateEmbeddingsBatch(
  texts: string[],
): Promise<(number[] | null)[]> {
  try {
    const response = await callVoyageAPI(texts, "document");
    return response.data.map((d) => d.embedding);
  } catch (err) {
    console.error("Batch embedding generation failed:", err);
    return texts.map(() => null);
  }
}

export async function generateQueryEmbedding(
  text: string,
): Promise<number[] | null> {
  try {
    const response = await callVoyageAPI([text], "query");
    return response.data[0].embedding;
  } catch (err) {
    console.error("Query embedding generation failed:", err);
    return null;
  }
}
