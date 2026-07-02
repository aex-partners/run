import { Json } from '@/shared/domain/Json'
import { Result } from '@/shared/kernel/Result'

// What an MCP tool looks like to the AI runtime. A tool is just a DRIVING
// ADAPTER: a thin shell that turns the AI's JSON call into an in-port command of
// the owning context — the same in-port the tRPC controller uses. `readOnly`
// drives the auto-execute vs human-confirmation policy (the AEX tool-registry).
export interface ToolDefinition {
  name: string
  readOnly: boolean
  description: string
  execute(input: Json): Promise<Result<Json>>
}
