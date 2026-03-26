/**
 * Tool invocation states - compatible with AI SDK Elements ToolUIPart states.
 * Defined locally so we don't depend on the `ai` npm package.
 */
export type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error"
  | "output-denied"
  | "approval-requested"
  | "approval-responded"

/**
 * Chat status for prompt input states.
 */
export type ChatStatus = "submitted" | "streaming" | "ready" | "error"
