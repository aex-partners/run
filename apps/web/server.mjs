import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { createProxyServer } from "http-proxy";

const PORT = parseInt(process.env.PORT || "3000", 10);
const API_URL = process.env.API_URL || "http://localhost:3001";
const DIST = join(import.meta.dirname, "dist");

const proxy = createProxyServer({ target: API_URL, changeOrigin: true, ws: true });

proxy.on("error", (err, _req, res) => {
  console.error("Proxy error:", err.message);
  if (res.writeHead) res.writeHead(502).end("Bad Gateway");
});

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const indexHtml = readFileSync(join(DIST, "index.html"));

const server = createServer((req, res) => {
  const url = req.url || "/";

  // Proxy API and auth routes
  if (url.startsWith("/api/") || url.startsWith("/ws")) {
    return proxy.web(req, res);
  }

  // Serve static files
  const filePath = join(DIST, url);
  if (url !== "/" && existsSync(filePath)) {
    const ext = extname(filePath);
    const mime = MIME[ext] || "application/octet-stream";
    const body = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable" });
    res.end(body);
    return;
  }

  // SPA fallback
  res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-cache" });
  res.end(indexHtml);
});

// WebSocket upgrade
server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/ws")) {
    proxy.ws(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server listening on :${PORT}, proxying API to ${API_URL}`);
});
