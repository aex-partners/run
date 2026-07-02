import { SubagentRunner } from '@/contexts/assistant/application/ports/out/SubagentRunner'
import { SubagentDef, buildSubagents } from '@/contexts/assistant/domain/Subagents'

// Default driven adapter for SubagentRunner: serves the static subagent catalog
// from the domain. Swap for a DB-backed adapter when subagents become dynamic.
export class StaticSubagentRunner implements SubagentRunner {
  definitions(): Record<string, SubagentDef> {
    return buildSubagents()
  }
}
