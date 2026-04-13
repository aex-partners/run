import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { sql } from "drizzle-orm";
import type { ToolContext } from "../types.js";
import { entities, entityRecords } from "../../db/schema/index.js";
import { parseFields } from "../../db/entity-fields.js";

const SEARXNG_URL = process.env.SEARXNG_URL || "http://searxng:8080";

interface WebResult {
  title: string;
  url: string;
  snippet: string;
  engine: string;
}

async function runSearxng(query: string, maxResults: number, lang: string): Promise<WebResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    language: lang,
    pageno: "1",
  });

  const res = await fetch(`${SEARXNG_URL}/search?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`SearXNG returned ${res.status}`);
  }

  const data = (await res.json()) as {
    results: Array<WebResult & { content: string }>;
  };

  return data.results.slice(0, maxResults).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
    engine: r.engine,
  }));
}

interface CrmHit {
  entity: string;
  record_id: string;
  matched_fields: string[];
  data: Record<string, unknown>;
}

/**
 * Match tokens of the query against text-like fields across all entities.
 * Falls back when web search is unavailable so the agent still surfaces local
 * context (existing clients, leads, products) that might answer the question.
 */
async function runCrmFallback(ctx: ToolContext, query: string, maxResults: number): Promise<CrmHit[]> {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);

  if (tokens.length === 0) return [];

  const allEntities = await ctx.db.select().from(entities);
  if (allEntities.length === 0) return [];

  const hits: CrmHit[] = [];

  for (const entity of allEntities) {
    const likeClauses = tokens.map((t) => sql`lower(${entityRecords.data}) LIKE ${`%${t}%`}`);
    const rows = await ctx.db
      .select()
      .from(entityRecords)
      .where(sql`${entityRecords.entityId} = ${entity.id} AND (${sql.join(likeClauses, sql` OR `)})`)
      .limit(maxResults);

    const fields = parseFields(entity.fields);

    for (const row of rows) {
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(row.data as string); } catch { /* ignore */ }

      const matched: string[] = [];
      for (const f of fields) {
        const val = parsed[f.slug];
        if (typeof val !== "string") continue;
        const lower = val.toLowerCase();
        if (tokens.some((t) => lower.includes(t))) matched.push(f.name);
      }

      hits.push({
        entity: entity.name,
        record_id: row.id,
        matched_fields: matched,
        data: parsed,
      });

      if (hits.length >= maxResults) return hits;
    }
  }

  return hits;
}

export function buildSearchTools(ctx: ToolContext) {
  return [
    tool(
      "web_search",
      "Search the web using multiple search engines (Google, Bing, DuckDuckGo). Returns real-time results with titles, URLs, and snippets. Use this for any web research: finding companies, CNPJs, prices, news, regulations, etc. If the web engine is unavailable, this tool falls back to searching the local CRM (clients, leads, products) so the agent still has something to work with.",
      {
        query: z.string().describe("Search query"),
        max_results: z.number().optional().describe("Max results to return (default 10)"),
        language: z.string().optional().describe("Language code (default pt-BR)"),
      },
      async ({ query, max_results, language }) => {
        const maxResults = max_results ?? 10;
        const lang = language ?? "pt-BR";
        let webError: string | null = null;

        try {
          const results = await runSearxng(query, maxResults, lang);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ source: "web", results, total: results.length, query }),
            }],
          };
        } catch (err) {
          webError = err instanceof Error ? err.message : String(err);
        }

        // Web search failed. Fall back to local CRM records so the agent still has
        // context to reason over (e.g. "do we already have a client in this region?").
        try {
          const crm = await runCrmFallback(ctx, query, maxResults);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                source: "crm_fallback",
                web_error: webError,
                note: "Web search is unavailable. Returning matches from the local CRM (entity records). Only records already in the database are shown.",
                results: crm,
                total: crm.length,
                query,
              }),
            }],
          };
        } catch (fallbackErr) {
          return {
            content: [{
              type: "text" as const,
              text: `Search failed: ${webError}. CRM fallback also failed: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
            }],
            isError: true,
          };
        }
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "fetch_url",
      "Fetch the text content of a web page. Use this to read specific URLs found via web_search.",
      {
        url: z.string().url().describe("URL to fetch"),
      },
      async ({ url }) => {
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            signal: AbortSignal.timeout(15000),
          });
          const html = await res.text();

          let text = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&nbsp;/g, " ")
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, " ")
            .trim();

          if (text.length > 6000) text = text.slice(0, 6000) + "...";

          return { content: [{ type: "text" as const, text }] };
        } catch (err) {
          return {
            content: [{
              type: "text" as const,
              text: `Fetch failed: ${err instanceof Error ? err.message : "Unknown error"}`,
            }],
            isError: true,
          };
        }
      },
      { annotations: { readOnlyHint: true } },
    ),
  ];
}

/**
 * Startup health probe. Non-fatal; just logs so operators know why the agent
 * will use the CRM fallback path.
 */
export async function probeSearxngHealth(): Promise<void> {
  try {
    const res = await fetch(`${SEARXNG_URL}/healthz`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      console.log(`[search] SearXNG reachable at ${SEARXNG_URL}`);
    } else {
      console.warn(`[search] SearXNG at ${SEARXNG_URL} returned ${res.status}; web_search will fall back to CRM`);
    }
  } catch (err) {
    console.warn(
      `[search] SearXNG at ${SEARXNG_URL} not reachable (${err instanceof Error ? err.message : err}); web_search will fall back to CRM`,
    );
  }
}
