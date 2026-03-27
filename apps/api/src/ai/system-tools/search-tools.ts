import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const SEARXNG_URL = process.env.SEARXNG_URL || "http://searxng:8080";

export function buildSearchTools() {
  return [
    tool(
      "web_search",
      "Search the web using multiple search engines (Google, Bing, DuckDuckGo). Returns real-time results with titles, URLs, and snippets. Use this for any web research: finding companies, CNPJs, prices, news, regulations, etc.",
      {
        query: z.string().describe("Search query"),
        max_results: z.number().optional().describe("Max results to return (default 10)"),
        language: z.string().optional().describe("Language code (default pt-BR)"),
      },
      async ({ query, max_results, language }) => {
        const maxResults = max_results ?? 10;
        const lang = language ?? "pt-BR";
        try {
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

          const data = await res.json() as {
            results: Array<{
              title: string;
              url: string;
              content: string;
              engine: string;
            }>;
          };

          const results = data.results.slice(0, maxResults).map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.content,
            engine: r.engine,
          }));

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ results, total: results.length, query }),
            }],
          };
        } catch (err) {
          return {
            content: [{
              type: "text" as const,
              text: `Search failed: ${err instanceof Error ? err.message : "Unknown error"}. SearXNG may not be running.`,
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
