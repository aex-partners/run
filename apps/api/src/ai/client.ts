import { createOpenAI } from "@ai-sdk/openai";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { settings } from "../db/schema/index.js";

let cachedProvider: ReturnType<typeof createOpenAI> | null = null;

const DEFAULT_MODELS: Record<string, { chat: string; nano: string }> = {
  openai: { chat: "gpt-4.1", nano: "gpt-4.1-nano" },
  openrouter: { chat: "openai/gpt-4.1", nano: "openai/gpt-4.1-nano" },
};

let resolvedProviderType: string = "openai";

async function getAIConfig(): Promise<{ apiKey: string; provider: string }> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(eq(settings.key, "ai.apiKey"))
    .limit(1);

  const [providerRow] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "ai.provider"))
    .limit(1);

  const apiKey = rows[0]?.value;
  if (!apiKey) {
    throw new Error("AI API key not configured. Complete the setup wizard first.");
  }

  return { apiKey, provider: providerRow?.value ?? "openai" };
}

export async function getProvider() {
  if (cachedProvider) return cachedProvider;

  const { apiKey, provider } = await getAIConfig();
  resolvedProviderType = provider;

  if (provider === "openrouter") {
    cachedProvider = createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      compatibility: "compatible",
    });
  } else {
    cachedProvider = createOpenAI({ apiKey, compatibility: "strict" });
  }

  return cachedProvider;
}

export async function getModel(modelId?: string | null) {
  const provider = await getProvider();
  const defaults = DEFAULT_MODELS[resolvedProviderType] ?? DEFAULT_MODELS.openai;
  return provider.chat(modelId || defaults.chat);
}

export async function getNanoModel() {
  const provider = await getProvider();
  const defaults = DEFAULT_MODELS[resolvedProviderType] ?? DEFAULT_MODELS.openai;
  return provider.chat(defaults.nano);
}

/**
 * Reset cached provider (e.g. when API key changes in settings).
 */
export function resetProvider() {
  cachedProvider = null;
}
