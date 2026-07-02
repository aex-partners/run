import { Json } from '@/shared/domain/Json'
import { Result } from '@/shared/kernel/Result'

// What a tool looks like to the runtime when it builds the MCP catalog: a name, a
// description for the LLM, and the read-only flag (drives the confirmation policy
// for dynamic piece tools). Optional richer view of the ToolBox; the demo path
// only needs names()+execute().
export interface ToolDescriptor {
  name: string
  description: string
  readOnly?: boolean
}

// ACL out-port. The set of tools the agent may call. assistant must NOT import
// other contexts, so it declares this capability; main fulfills it by routing
// each tool name to that context's MCP tool (which calls its in-port). This is
// how the AI reuses every context's in-ports without the assistant depending on
// any of them.
export interface ToolBox {
  names(): string[]
  execute(name: string, input: Json): Promise<Result<Json>>
  // Optional. The streaming runtime uses it to register MCP tools with
  // descriptions; when absent it falls back to names() with a generic schema.
  descriptors?(): ToolDescriptor[]
}
