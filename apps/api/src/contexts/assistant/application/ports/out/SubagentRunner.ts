import { SubagentDef } from '@/contexts/assistant/domain/Subagents'

// Driven port: the catalog of specialist subagents the main agent may spawn via the
// Agent tool. The subagents EXECUTE inside the runtime (the SDK spawns them); this
// port only supplies their definitions, so the catalog can later become dynamic
// (DB-driven) without touching the orchestration. The default adapter returns
// domain's static buildSubagents().
export interface SubagentRunner {
  definitions(): Record<string, SubagentDef>
}
