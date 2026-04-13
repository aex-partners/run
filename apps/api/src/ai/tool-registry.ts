// Read-only tools auto-execute without user confirmation
export const READ_ONLY_TOOLS = new Set([
  "mcp__aex__query_records",
  "mcp__aex__list_entities",
  "mcp__aex__list_workflows",
  "mcp__aex__list_tasks",
  "mcp__aex__list_agents",
  "WebSearch",
  "WebFetch",
  "ToolSearch",
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "Agent",
  "AskUserQuestion",
  "TodoWrite",
  "mcp__aex__list_files",
  "mcp__aex__search_files",
  "mcp__aex__query_knowledge",
  "mcp__aex__web_search",
  "mcp__aex__fetch_url",
  "mcp__aex__list_reminders",
]);

// Mutating tools require user confirmation
export const MUTATING_TOOLS = new Set([
  "mcp__aex__create_entity",
  "mcp__aex__add_field",
  "mcp__aex__insert_record",
  "mcp__aex__update_record",
  "mcp__aex__delete_record",
  "mcp__aex__create_task",
  "mcp__aex__create_workflow",
  "mcp__aex__execute_workflow",
  "mcp__aex__send_email",
  "mcp__aex__create_file",
  "mcp__aex__generate_pdf",
  "mcp__aex__save_knowledge",
  "mcp__aex__delete_knowledge",
  "mcp__aex__schedule_reminder",
  "mcp__aex__cancel_reminder",
  "mcp__aex__schedule_task",
]);

export function isReadOnlyTool(toolName: string): boolean {
  return READ_ONLY_TOOLS.has(toolName);
}
