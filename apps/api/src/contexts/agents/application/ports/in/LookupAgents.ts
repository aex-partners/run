// Driving port (read) serving other contexts' ACL. Agents owns the `agents`
// table; conversations resolves agent identities through this port instead of
// reading `agents` directly: bySlug('eric') for EnsureEric, byIds for author
// names. Empty ids -> []; an unknown slug -> null.
export interface AgentRef {
  id: string
  name: string
  slug: string
}

export interface LookupAgents {
  byIds(ids: string[]): Promise<AgentRef[]>
  bySlug(slug: string): Promise<AgentRef | null>
}
