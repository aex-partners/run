// ACL out-port -> identity/users + assistant/agents. Forwarding stamps each copy
// with the ORIGINAL author's display name. A Message aggregate only stores
// authorId/agentId, so the use case asks this directory to resolve the shown name
// (user name, else agent name, else null when neither resolves). The conversations
// context MUST NOT import identity/agents; main bridges this to those contexts'
// in-ports.
export interface AuthorDirectory {
  displayName(authorId: string | null, agentId: string | null): Promise<string | null>
}
