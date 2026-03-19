import { createOpenAI } from "@ai-sdk/openai";
import { env } from "../env.js";

export const openaiProvider = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  compatibility: "strict",
});
export const model = openaiProvider.chat("gpt-4.1");
export const nanoModel = openaiProvider.chat("gpt-4.1-nano");

/**
 * Get an AI model by ID. Falls back to default gpt-4.1 if null/undefined.
 */
export function getModel(modelId?: string | null) {
  if (!modelId) return model;
  return openaiProvider.chat(modelId);
}
