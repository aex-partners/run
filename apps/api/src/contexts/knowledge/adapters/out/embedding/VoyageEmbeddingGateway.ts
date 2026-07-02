import { EmbeddingGateway } from '@/contexts/knowledge/application/ports/out/EmbeddingGateway'

// Driven adapter for the EmbeddingGateway ACL port. Wraps the Voyage AI
// embeddings API (voyage-3, 1024 dimensions), authenticated with the Anthropic
// key, exactly as AEX's embedding-service does. Best-effort: any failure yields
// null so callers fall back to text search.
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3'

interface VoyageResponse {
  data: Array<{ embedding: number[] }>
}

export class VoyageEmbeddingGateway implements EmbeddingGateway {
  constructor(private readonly apiKey: string) {}

  embedDocument(text: string): Promise<number[] | null> {
    return this.call(text, 'document')
  }

  embedQuery(text: string): Promise<number[] | null> {
    return this.call(text, 'query')
  }

  private async call(text: string, inputType: 'document' | 'query'): Promise<number[] | null> {
    try {
      const res = await fetch(VOYAGE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: VOYAGE_MODEL, input: [text], input_type: inputType }),
      })

      if (!res.ok) {
        const body = await res.text()
        console.error(`[knowledge] Voyage API error ${res.status}: ${body}`)
        return null
      }

      const json = (await res.json()) as VoyageResponse
      return json.data[0]?.embedding ?? null
    } catch (err) {
      console.error('[knowledge] embedding request failed:', err)
      return null
    }
  }
}
