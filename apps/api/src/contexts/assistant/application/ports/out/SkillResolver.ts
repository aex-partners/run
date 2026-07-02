// ACL out-port -> the skills context. Given skill ids linked to an agent, returns
// each skill's prompt fragment and tool ids so the AgentDirectory can fold them
// into the AgentConfig. Ported from the skill-loading half of agent-resolver.ts.
// The PURE routine->skill-template selection lives in domain (getSkillsForRoutines);
// this port is only the by-id lookup against persisted skills. main bridges it to
// the skills context.
export interface ResolvedSkill {
  id: string
  systemPrompt: string | null
  toolIds: string[]
}

export interface SkillResolver {
  resolveSkills(skillIds: string[]): Promise<ResolvedSkill[]>
}
