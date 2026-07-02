// ACL (anti-corruption) out-port -> identity/users + assistant/agents. The read
// adapters store only authorId/agentId/peer userIds; they MUST NOT read the
// `users` or `agents` tables. They batch-collect the distinct ids and ask this
// directory to resolve display names. main bridges userNames -> identity.GetUsers
// and agentNames -> agents.LookupAgents.byIds. An id that resolves to nothing is
// simply absent from the returned map (callers apply their own default).
export interface NameResolver {
  userNames(ids: string[]): Promise<Map<string, string>>
  agentNames(ids: string[]): Promise<Map<string, string>>
}
