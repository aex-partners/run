// ACL (anti-corruption) out-port -> the assistant/agents context. EnsureEric needs
// the id of the system "eric" agent to bind the AI conversation to it. The
// conversations context MUST NOT import assistant/agents; the composition root
// bridges this to that context's in-port (which owns the slug -> agent mapping).
// Declared here only; conversations never reads the `agents` table itself.
export interface AgentDirectory {
  ericAgentId(): Promise<string | null>
}
