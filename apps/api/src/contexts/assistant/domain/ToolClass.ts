// VO + pure policy data. Every tool the AI may call is either READ-ONLY (safe to
// auto-execute) or MUTATING (changes state / has external side effects, so it is
// gated behind human confirmation). Ported 1:1 from AEX's tool-registry.ts. This
// is pure domain knowledge: no IO, no npm, no platform.

export type ToolClass = 'read-only' | 'mutating'

// Read-only tools auto-execute without user confirmation. Names are stored
// without the `mcp__aex__` MCP prefix; `classifyTool` normalises before lookup.
export const READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'query',
  'query_records',
  'describe_entity',
  'list_entities',
  'list_flows',
  'list_tasks',
  'list_agents',
  'query_knowledge',
  'web_search',
  'fetch_url',
  'list_reminders',
  'search_pieces',
  // Files (read)
  'list_files',
  'search_files',
  'get_file_info',
  'read_file_content',
  // Email (read). read_email marks the message read as a side effect, the same
  // as opening it in a mail client; it stays auto-allowed like any "open".
  'list_emails',
  'read_email',
  'get_email_thread',
  'search_emails',
  'list_mail_accounts',
  'email_folder_counts',
  'list_email_labels',
  // SDK built-ins (no MCP prefix)
  'WebSearch',
  'WebFetch',
  'ToolSearch',
  'Read',
  'Glob',
  'Grep',
  'Agent',
  'AskUserQuestion',
  'TodoWrite',
])

// Mutating tools require user confirmation before they run.
export const MUTATING_TOOLS: ReadonlySet<string> = new Set([
  'create_entity',
  'add_field',
  'insert_record',
  'update_record',
  'delete_record',
  'create_task',
  'create_flow',
  'run_flow',
  'set_flow_enabled',
  'delete_flow',
  'send_email',
  'generate_pdf',
  'save_knowledge',
  'delete_knowledge',
  'schedule_reminder',
  'cancel_reminder',
  'schedule_task',
  'cancel_task',
  'suggest_install',
  // Files (mutating)
  'create_folder',
  'write_text_file',
  'rename_file',
  'move_file',
  'star_file',
  'delete_file',
  'restore_file',
  'share_file',
  'index_file_for_ai',
  // Email (mutating)
  'sync_emails',
  'reply_email',
  'forward_email',
  'mark_emails_read',
  'mark_emails_unread',
  'star_email',
  'archive_emails',
  'delete_emails',
  'move_emails_to_spam',
  'snooze_email',
  'create_email_label',
  'delete_email_label',
  'toggle_email_label',
  'summarize_email',
])

// The default tool allow-list handed to the runtime. Bash/Write/Edit are
// deliberately excluded from the user-facing agent: it would be a prompt-injection
// RCE surface. Business ops all go through `mcp__aex__*` (the ToolBox ACL).
export const DEFAULT_ALLOWED_TOOLS: readonly string[] = [
  'mcp__aex__*',
  'WebSearch',
  'WebFetch',
  'ToolSearch',
  'Read',
  'Glob',
  'Grep',
  'Agent',
  'AskUserQuestion',
  'TodoWrite',
]

// Strip the MCP server prefix so a tool can be looked up by its bare name
// regardless of whether the runtime reported `create_entity` or
// `mcp__aex__create_entity`.
export function normalizeToolName(name: string): string {
  return name.replace(/^mcp__aex__/, '')
}

// Pure classification. Explicit lists win; otherwise fall back to a per-tool
// read-only hint (the ToolBox descriptor flag for dynamic piece tools). Unknown
// tools are treated as MUTATING — fail safe, so a new tool can never silently
// auto-execute a side effect.
export function classifyTool(name: string, opts?: { readOnlyHint?: boolean }): ToolClass {
  const bare = normalizeToolName(name)
  if (READ_ONLY_TOOLS.has(bare) || READ_ONLY_TOOLS.has(name)) return 'read-only'
  if (MUTATING_TOOLS.has(bare) || MUTATING_TOOLS.has(name)) return 'mutating'
  if (opts?.readOnlyHint === true) return 'read-only'
  return 'mutating'
}
