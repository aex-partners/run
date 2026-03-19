/**
 * Script to generate a piece catalog JSON from the ActivePieces community pieces.
 * Reads package.json and source files from each piece to extract metadata.
 *
 * Usage: npx tsx scripts/generate-piece-catalog.ts
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";

const AP_PIECES_DIR = "/home/ahlert/Dev/activepieces/packages/pieces/community";
const OUTPUT_FILE = join(import.meta.dirname, "../data/piece-catalog.json");

// Category keywords for fallback classification
const CATEGORY_KEYWORDS: [string[], string][] = [
  [["ai", "llm", "gpt", "claude", "gemini", "bedrock", "mistral", "groq", "perplexity", "ollama", "openai", "anthropic", "cohere", "replicate", "hugging"], "ARTIFICIAL_INTELLIGENCE"],
  [["slack", "discord", "telegram", "whatsapp", "teams", "twilio", "sms", "chat", "messenger", "email", "mail", "sendgrid", "mailchimp", "postmark", "resend"], "COMMUNICATION"],
  [["shopify", "woocommerce", "bigcommerce", "saleor", "commerce", "store", "ecommerce"], "COMMERCE"],
  [["stripe", "paypal", "square", "razorpay", "mollie", "payment", "invoice", "billing"], "PAYMENT_PROCESSING"],
  [["salesforce", "hubspot", "pipedrive", "zoho", "crm", "close", "copper", "freshsales"], "SALES_AND_CRM"],
  [["notion", "airtable", "sheets", "calendar", "trello", "asana", "monday", "todoist", "clickup", "baserow", "coda"], "PRODUCTIVITY"],
  [["github", "gitlab", "jira", "linear", "sentry", "datadog", "api", "webhook", "http", "code", "sql", "database", "postgres", "mysql", "mongo", "redis", "supabase", "firebase"], "DEVELOPER_TOOLS"],
  [["wordpress", "drive", "dropbox", "s3", "box", "onedrive", "storage", "file", "pdf", "image", "video", "media"], "CONTENT_AND_FILES"],
  [["facebook", "instagram", "twitter", "linkedin", "ads", "marketing", "mailerlite", "convertkit", "drip", "campaign"], "MARKETING"],
  [["intercom", "zendesk", "freshdesk", "helpscout", "crisp", "tawk", "support", "ticket"], "CUSTOMER_SUPPORT"],
  [["typeform", "form", "survey", "tally", "jotform"], "FORMS_AND_SURVEYS"],
  [["bamboohr", "gusto", "hr", "employee", "recruit"], "HUMAN_RESOURCES"],
  [["quickbooks", "xero", "freshbooks", "accounting", "bookkeeping", "tax"], "ACCOUNTING"],
  [["analytics", "mixpanel", "amplitude", "segment", "posthog", "plausible", "matomo"], "BUSINESS_INTELLIGENCE"],
];

function inferCategory(name: string, sourceCategory?: string): string {
  if (sourceCategory) return sourceCategory;
  const lower = name.toLowerCase();
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return "PRODUCTIVITY";
}

type AuthType = "oauth2" | "secret_text" | "basic_auth" | "custom_auth" | "none";

interface AuthInfo {
  type: AuthType;
  displayName?: string;
  description?: string;
  // OAuth2 specific
  authUrl?: string;
  tokenUrl?: string;
  scope?: string[];
}

interface PieceCatalogEntry {
  id: string;
  name: string;
  pieceName: string;
  displayName: string;
  description: string;
  version: string;
  category: string;
  logoUrl: string;
  auth: AuthInfo;
  source: "piece";
}

interface SourceExtract {
  displayName?: string;
  description?: string;
  logoUrl?: string;
  categories?: string[];
  auth?: AuthInfo;
}

/**
 * Scan all .ts files in a piece's src/ for auth type patterns.
 */
async function readAllTsFiles(dir: string): Promise<string> {
  let result = "";
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        result += await readAllTsFiles(fullPath);
      } else if (entry.name.endsWith(".ts")) {
        try {
          result += "\n" + await readFile(fullPath, "utf-8");
        } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }
  return result;
}

async function extractAuthFromPiece(dir: string): Promise<AuthInfo> {
  const srcDir = join(AP_PIECES_DIR, dir, "src");
  const allContent = await readAllTsFiles(srcDir);

  if (!allContent) return { type: "none" };

  // Detect auth type from PieceAuth.* calls
  const hasOAuth2 = /PieceAuth\.OAuth2\s*\(/.test(allContent);
  const hasSecretText = /PieceAuth\.SecretText\s*\(/.test(allContent);
  const hasBasicAuth = /PieceAuth\.BasicAuth\s*\(/.test(allContent);
  const hasCustomAuth = /PieceAuth\.CustomAuth\s*\(/.test(allContent);
  const hasNone = /PieceAuth\.None\s*\(/.test(allContent);

  // Extract OAuth2 details if present
  if (hasOAuth2) {
    const authUrlMatch = allContent.match(/authUrl:\s*['"`]([^'"`]+)['"`]/);
    const tokenUrlMatch = allContent.match(/tokenUrl:\s*['"`]([^'"`]+)['"`]/);
    const scopeMatches = [...allContent.matchAll(/['"`]([a-zA-Z0-9.:_/-]+)['"`]/g)]
      .map((m) => m[1])
      .filter((s) => s.includes(":") || s.includes(".") || s.includes("/"));

    return {
      type: "oauth2",
      authUrl: authUrlMatch?.[1],
      tokenUrl: tokenUrlMatch?.[1],
    };
  }

  if (hasSecretText) return { type: "secret_text" };
  if (hasCustomAuth) return { type: "custom_auth" };
  if (hasBasicAuth) return { type: "basic_auth" };
  if (hasNone) return { type: "none" };

  // If auth property references an imported auth but we couldn't detect the type
  const authImport = allContent.match(/auth:\s*(\w+)/);
  if (authImport && authImport[1] !== "undefined") {
    // Has auth but unknown type, default to secret_text
    return { type: "secret_text" };
  }

  return { type: "none" };
}

async function extractFromSource(dir: string): Promise<SourceExtract> {
  for (const filename of ["src/index.ts", "src/index.js"]) {
    try {
      const content = await readFile(join(AP_PIECES_DIR, dir, filename), "utf-8");

      const createPieceIdx = content.indexOf("createPiece(");
      const pieceBlock = createPieceIdx >= 0 ? content.slice(createPieceIdx) : content;

      const dnMatch = pieceBlock.match(/displayName:\s*['"`]([^'"`]+)['"`]/);
      const descMatch = pieceBlock.match(/description:\s*['"`]([^'"`]+)['"`]/);
      const logoMatch = pieceBlock.match(/logoUrl:\s*['"`]([^'"`]+)['"`]/);
      const catMatches = [...content.matchAll(/PieceCategory\.(\w+)/g)].map((m) => m[1]);

      const auth = await extractAuthFromPiece(dir);

      return {
        displayName: dnMatch?.[1],
        description: descMatch?.[1],
        logoUrl: logoMatch?.[1],
        categories: catMatches.length > 0 ? catMatches : undefined,
        auth,
      };
    } catch {
      continue;
    }
  }
  return {};
}

async function main() {
  const dirs = await readdir(AP_PIECES_DIR);
  const catalog: PieceCatalogEntry[] = [];
  let extracted = 0;
  const authStats: Record<string, number> = {};

  for (const dir of dirs.sort()) {
    try {
      const pkgPath = join(AP_PIECES_DIR, dir, "package.json");
      const content = await readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(content);

      const pieceName = pkg.name as string;
      const shortName = dir;

      let displayName = shortName
        .split("-")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      let description = `${displayName} integration`;

      const source = await extractFromSource(dir);
      if (source.displayName) {
        displayName = source.displayName;
        extracted++;
      }
      if (source.description) {
        description = source.description;
      }

      const sourceCategory = source.categories?.[0];
      const category = inferCategory(shortName, sourceCategory);
      const logoUrl = source.logoUrl || `https://cdn.activepieces.com/pieces/${shortName}.png`;
      const auth = source.auth ?? { type: "none" as AuthType };

      authStats[auth.type] = (authStats[auth.type] || 0) + 1;

      catalog.push({
        id: `piece-${shortName}`,
        name: displayName,
        pieceName,
        displayName,
        description,
        version: pkg.version,
        category,
        logoUrl,
        auth,
        source: "piece",
      });
    } catch (err) {
      console.warn(`Skipping ${dir}: ${err}`);
    }
  }

  await writeFile(OUTPUT_FILE, JSON.stringify(catalog, null, 2));
  console.log(`Generated catalog with ${catalog.length} pieces (${extracted} with extracted displayName)`);
  console.log(`Auth types: ${JSON.stringify(authStats)}`);
}

main().catch(console.error);
