import type { LanguageModelV1, LanguageModelV1StreamPart } from "ai";

interface MockToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

interface MockModelOptions {
  text?: string;
  toolCalls?: MockToolCall[];
}

/**
 * Creates a mock LanguageModelV1 that returns predefined text or tool calls.
 * Used to test the agent flow without hitting the real OpenAI API.
 */
export function createTestModel(options: MockModelOptions = {}): LanguageModelV1 {
  const { text = "", toolCalls = [] } = options;

  return {
    specificationVersion: "v2" as any,
    provider: "test",
    modelId: "test-model",
    defaultObjectGenerationMode: "json",

    doGenerate: async () => ({
      text,
      toolCalls: toolCalls.map((tc) => ({
        toolCallType: "function" as const,
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: JSON.stringify(tc.args),
      })),
      finishReason: toolCalls.length > 0 ? ("tool-calls" as const) : ("stop" as const),
      usage: { promptTokens: 10, completionTokens: 5 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),

    doStream: async () => {
      const parts: LanguageModelV1StreamPart[] = [];

      if (text) {
        parts.push({ type: "text-delta", textDelta: text });
      }

      for (const tc of toolCalls) {
        parts.push({
          type: "tool-call",
          toolCallType: "function",
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: JSON.stringify(tc.args),
        });
      }

      parts.push({
        type: "finish",
        finishReason: toolCalls.length > 0 ? "tool-calls" : "stop",
        usage: { promptTokens: 10, completionTokens: 5 },
      });

      return {
        stream: new ReadableStream<LanguageModelV1StreamPart>({
          start(controller) {
            for (const part of parts) {
              controller.enqueue(part);
            }
            controller.close();
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}
