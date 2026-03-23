import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb, seedTestUser, createToolContext, closeTestDb } from "../test/helpers.js";
import { createTools } from "./tools.js";

vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const db = getTestDb();
let tools: ReturnType<typeof createTools>;

beforeAll(async () => {
  await cleanDb();
  await seedTestUser(db);
  tools = createTools(createToolContext(db));
});

afterAll(async () => {
  await closeTestDb();
});

describe("tools: fetch_url SSRF protection", () => {
  it("blocks localhost", async () => {
    const result = await tools.fetch_url.execute(
      { url: "http://localhost:3000/admin" },
      { toolCallId: "ssrf-1" },
    );
    expect(result.error).toContain("internal/private");
  });

  it("blocks 127.0.0.1", async () => {
    const result = await tools.fetch_url.execute(
      { url: "http://127.0.0.1:8080/secret" },
      { toolCallId: "ssrf-2" },
    );
    expect(result.error).toContain("internal/private");
  });

  it("blocks 192.168.x.x", async () => {
    const result = await tools.fetch_url.execute(
      { url: "http://192.168.1.1/config" },
      { toolCallId: "ssrf-3" },
    );
    expect(result.error).toContain("internal/private");
  });

  it("blocks 10.x.x.x", async () => {
    const result = await tools.fetch_url.execute(
      { url: "http://10.0.0.1/internal" },
      { toolCallId: "ssrf-4" },
    );
    expect(result.error).toContain("internal/private");
  });

  it("blocks .local domain", async () => {
    const result = await tools.fetch_url.execute(
      { url: "http://myservice.local/api" },
      { toolCallId: "ssrf-5" },
    );
    expect(result.error).toContain("internal/private");
  });

  it("rejects non-http protocol", async () => {
    const result = await tools.fetch_url.execute(
      { url: "ftp://example.com/file.txt" },
      { toolCallId: "ssrf-6" },
    );
    expect(result.error).toContain("Only http and https");
  });
});

describe("tools: fetch_url with mocked fetch", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("successfully fetches and extracts text from HTML", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () =>
        `<html><head><title>Test Page</title></head><body><h1>Hello World</h1><p>Content here</p></body></html>`,
    });

    const result = await tools.fetch_url.execute(
      { url: "https://example.com/page" },
      { toolCallId: "fetch-1" },
    );

    expect(result.url).toBe("https://example.com/page");
    expect(result.title).toBe("Test Page");
    expect(result.content).toContain("Hello World");
    expect(result.content).toContain("Content here");
  });

  it("returns error for non-text content types", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      text: async () => "",
    });

    const result = await tools.fetch_url.execute(
      { url: "https://example.com/image.png" },
      { toolCallId: "fetch-2" },
    );

    expect(result.error).toContain("Unsupported content type");
  });

  it("returns error on HTTP failure status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers(),
      text: async () => "Not found",
    });

    const result = await tools.fetch_url.execute(
      { url: "https://example.com/missing" },
      { toolCallId: "fetch-3" },
    );

    expect(result.error).toContain("404");
  });

  it("returns error on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await tools.fetch_url.execute(
      { url: "https://unreachable.example.com" },
      { toolCallId: "fetch-4" },
    );

    expect(result.error).toContain("Network error");
  });
});

describe("tools: web_search with mocked fetch", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns parsed results from mocked DuckDuckGo HTML", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        `<a href="https://example.com" class='result-link'>Example Title</a><td class='result-snippet'>Example snippet text</td>`,
    });

    const result = await tools.web_search.execute(
      { query: "test query" },
      { toolCallId: "search-1" },
    );

    expect(result.query).toBe("test query");
    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBe("Example Title");
    expect(result.results[0].snippet).toBe("Example snippet text");
    expect(result.results[0].url).toBe("https://example.com");
  });

  it("returns empty results when HTML has no matches", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body>No results here</body></html>`,
    });

    const result = await tools.web_search.execute(
      { query: "obscure query" },
      { toolCallId: "search-2" },
    );

    expect(result.results).toHaveLength(0);
    expect(result.message).toContain("No results");
  });

  it("returns error on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await tools.web_search.execute(
      { query: "failing query" },
      { toolCallId: "search-3" },
    );

    expect(result.error).toContain("Network error");
  });

  it("returns error on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const result = await tools.web_search.execute(
      { query: "server error query" },
      { toolCallId: "search-4" },
    );

    expect(result.error).toContain("503");
  });

  it("respects num_results parameter", async () => {
    const links = Array.from({ length: 5 }, (_, i) =>
      `<a href="https://example${i}.com" class='result-link'>Title ${i}</a><td class='result-snippet'>Snippet ${i}</td>`
    ).join("");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => links,
    });

    const result = await tools.web_search.execute(
      { query: "many results", num_results: 2 },
      { toolCallId: "search-5" },
    );

    expect(result.results.length).toBeLessThanOrEqual(2);
  });
});
