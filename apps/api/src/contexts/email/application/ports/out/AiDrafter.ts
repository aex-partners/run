// ACL / driven port toward the AI/assistant context. The email context owns no
// LLM: summarising and drafting are delegated across an anti-corruption boundary
// that main wires to the assistant context (AEX called Claude Haiku directly).
// Declared here only — no adapter lives in this context.
export interface AiDraftInput {
  subject: string
  from: string
  body: string
  prompt?: string
}

export interface AiDrafter {
  // Whether AI features for email are enabled (AEX's mail.ai.enabled setting).
  isEnabled(): Promise<boolean>
  // One-to-two sentence summary of an email body.
  summarize(body: string): Promise<string>
  // A professional reply draft for an email, optionally steered by a prompt.
  draft(input: AiDraftInput): Promise<string>
}
