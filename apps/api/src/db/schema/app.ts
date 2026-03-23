import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  index,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  name: text("name"),
  type: text("type", { enum: ["dm", "channel", "ai"] }).notNull().default("ai"),
  agentId: text("agent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
    pinned: integer("pinned").default(0),
    favorite: integer("favorite").default(0),
    muted: integer("muted").default(0),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    agentId: text("agent_id"),
    content: text("content").notNull(),
    role: text("role", { enum: ["user", "ai", "system"] })
      .notNull()
      .default("user"),
    metadata: text("metadata"),
    pinned: integer("pinned").default(0),
    starred: integer("starred").default(0),
    deletedAt: timestamp("deleted_at"),
    deletedFor: text("deleted_for"),
    reactions: text("reactions"),
    audioUrl: text("audio_url"),
    audioDuration: text("audio_duration"),
    audioWaveform: text("audio_waveform"),
    audioTranscription: text("audio_transcription"),
    audioTranscriptionEdited: integer("audio_transcription_edited").default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
  ],
);

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["pending", "running", "completed", "failed", "cancelled"] }).notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  createdBy: text("created_by").notNull().references(() => users.id),
  result: text("result"),
  error: text("error"),
  input: text("input").notNull(),
  scheduledAt: timestamp("scheduled_at"),
  type: text("type", { enum: ["inference", "structured"] }).notNull().default("inference"),
  agentId: text("agent_id"),
  toolName: text("tool_name"),
  inputSchema: text("input_schema"),
  outputSchema: text("output_schema"),
  structuredInput: text("structured_input"),
  workflowExecutionId: text("workflow_execution_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("tasks_status_idx").on(table.status),
]);

export const taskLogs = pgTable("task_logs", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  level: text("level", { enum: ["info", "warn", "error", "step"] }).notNull().default("info"),
  message: text("message").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("task_logs_task_id_idx").on(table.taskId),
]);

export const entities = pgTable("entities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  aiContext: text("ai_context"),
  fields: text("fields").notNull().default("[]"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const entityRecords = pgTable("entity_records", {
  id: text("id").primaryKey(),
  entityId: text("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  data: text("data").notNull().default("{}"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("entity_records_entity_id_idx").on(table.entityId),
]);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workflows = pgTable("workflows", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status", { enum: ["active", "paused"] }).notNull().default("paused"),
  triggerType: text("trigger_type", { enum: ["manual", "cron", "event"] }).notNull().default("manual"),
  triggerConfig: text("trigger_config").notNull().default("{}"),
  graph: text("graph").notNull().default('{"nodes":[],"edges":[]}'),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workflowExecutions = pgTable("workflow_executions", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "running", "completed", "failed"] }).notNull().default("pending"),
  triggeredBy: text("triggered_by").references(() => users.id),
  result: text("result"),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("workflow_executions_workflow_id_idx").on(table.workflowId),
  index("workflow_executions_status_idx").on(table.status),
]);

// --- Flow Engine (AP-based) ---

export const flowFolders = pgTable("flow_folders", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const flows = pgTable("flows", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["enabled", "disabled"] }).notNull().default("disabled"),
  folderId: text("folder_id").references(() => flowFolders.id, { onDelete: "set null" }),
  publishedVersionId: text("published_version_id"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const flowVersions = pgTable("flow_versions", {
  id: text("id").primaryKey(),
  flowId: text("flow_id").notNull().references(() => flows.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  trigger: text("trigger").notNull().default("{}"),
  state: text("state", { enum: ["draft", "locked"] }).notNull().default("draft"),
  valid: boolean("valid").notNull().default(false),
  schemaVersion: text("schema_version"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("flow_versions_flow_id_idx").on(table.flowId),
]);

export const flowRuns = pgTable("flow_runs", {
  id: text("id").primaryKey(),
  flowId: text("flow_id").notNull().references(() => flows.id, { onDelete: "cascade" }),
  flowVersionId: text("flow_version_id").references(() => flowVersions.id),
  status: text("status", { enum: ["running", "succeeded", "failed", "paused", "stopped"] }).notNull().default("running"),
  triggeredBy: text("triggered_by"),
  triggerPayload: text("trigger_payload"),
  steps: text("steps").notNull().default("{}"),
  duration: integer("duration"),
  tags: text("tags").notNull().default("[]"),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("flow_runs_flow_id_idx").on(table.flowId),
  index("flow_runs_status_idx").on(table.status),
]);

// --- Phase 7: Extensible Agent Platform ---

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  avatar: text("avatar"),
  systemPrompt: text("system_prompt").notNull(),
  modelId: text("model_id"),
  skillIds: text("skill_ids").notNull().default("[]"),
  toolIds: text("tool_ids").notNull().default("[]"),
  isSystem: boolean("is_system").notNull().default(false),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const skills = pgTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  toolIds: text("tool_ids").notNull().default("[]"),
  systemToolNames: text("system_tool_names").notNull().default("[]"),
  guardrails: text("guardrails").notNull().default("{}"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const plugins = pgTable("plugins", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  version: text("version").notNull(),
  author: text("author"),
  icon: text("icon"),
  category: text("category"),
  manifest: text("manifest"),
  pieceName: text("piece_name"),
  authType: text("auth_type"),
  source: text("source", { enum: ["registry", "local", "git", "piece"] }).notNull().default("registry"),
  sourceUrl: text("source_url"),
  status: text("status", { enum: ["available", "installed", "disabled", "installing", "error"] }).notNull().default("available"),
  config: text("config").notNull().default("{}"),
  installedAt: timestamp("installed_at"),
  installedBy: text("installed_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const credentials = pgTable("credentials", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  pluginName: text("plugin_name").notNull(),
  type: text("type", { enum: ["oauth2", "secret_text", "basic_auth", "custom_auth"] }).notNull(),
  status: text("status", { enum: ["active", "error", "missing"] }).notNull().default("active"),
  value: text("value").notNull().default("{}"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pluginStore = pgTable("plugin_store", {
  id: text("id").primaryKey(),
  pluginName: text("plugin_name").notNull(),
  scope: text("scope", { enum: ["project", "flow"] }).notNull().default("project"),
  scopeId: text("scope_id"),
  key: text("key").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const customTools = pgTable("custom_tools", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  inputSchema: text("input_schema").notNull(),
  outputSchema: text("output_schema"),
  type: text("type", { enum: ["http", "query", "code", "composite", "mcp"] }).notNull(),
  config: text("config").notNull().default("{}"),
  isReadOnly: boolean("is_read_only").notNull().default(false),
  integrationId: text("integration_id"),
  pluginId: text("plugin_id").references(() => plugins.id, { onDelete: "cascade" }),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const forms = pgTable("forms", {
  id: text("id").primaryKey(),
  entityId: text("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  fields: text("fields").notNull().default("[]"),
  settings: text("settings").notNull().default("{}"),
  publicToken: text("public_token").unique(),
  isPublic: integer("is_public").notNull().default(0),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const formSubmissions = pgTable("form_submissions", {
  id: text("id").primaryKey(),
  formId: text("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  entityRecordId: text("entity_record_id").references(() => entityRecords.id, { onDelete: "set null" }),
  data: text("data").notNull().default("{}"),
  submitterIp: text("submitter_ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("form_submissions_form_id_idx").on(table.formId),
]);

export const integrations = pgTable("integrations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  type: text("type", { enum: ["rest", "oauth2", "webhook"] }).notNull(),
  status: text("status", { enum: ["enabled", "disabled"] }).notNull().default("disabled"),
  config: text("config").notNull().default("{}"),
  credentials: text("credentials").notNull().default("{}"),
  webhookSecret: text("webhook_secret"),
  createdBy: text("created_by").notNull().references(() => users.id),
  installedAt: timestamp("installed_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// --- Files & Email ---

export const files = pgTable("files", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  mimeType: text("mime_type"),
  size: integer("size").notNull().default(0),
  path: text("path"),
  source: text("source", { enum: ["email", "chat", "generated", "upload", "workflow"] }).notNull().default("upload"),
  sourceRef: text("source_ref"),
  parentId: text("parent_id"),
  isFolder: integer("is_folder").notNull().default(0),
  starred: integer("starred").notNull().default(0),
  aiIndexed: integer("ai_indexed").notNull().default(0),
  publicToken: text("public_token").unique(),
  deletedAt: timestamp("deleted_at"),
  ownerId: text("owner_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("files_parent_id_idx").on(table.parentId),
  index("files_owner_id_idx").on(table.ownerId),
  index("files_source_idx").on(table.source),
]);

export const fileShares = pgTable("file_shares", {
  id: text("id").primaryKey(),
  fileId: text("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  access: text("access", { enum: ["viewer", "editor"] }).notNull().default("viewer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("file_shares_file_id_idx").on(table.fileId),
]);

export const emailAccounts = pgTable("email_accounts", {
  id: text("id").primaryKey(),
  integrationId: text("integration_id").notNull().references(() => integrations.id, { onDelete: "cascade" }),
  emailAddress: text("email_address").notNull(),
  displayName: text("display_name"),
  provider: text("provider", { enum: ["gmail", "outlook"] }).notNull(),
  syncStatus: text("sync_status", { enum: ["idle", "syncing", "error"] }).notNull().default("idle"),
  lastSyncAt: timestamp("last_sync_at"),
  syncCursor: text("sync_cursor"),
  ownerId: text("owner_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const emails = pgTable("emails", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => emailAccounts.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(),
  threadId: text("thread_id"),
  fromName: text("from_name").notNull(),
  fromEmail: text("from_email").notNull(),
  to: text("to").notNull().default("[]"),
  cc: text("cc").notNull().default("[]"),
  subject: text("subject").notNull().default(""),
  preview: text("preview").notNull().default(""),
  bodyHtml: text("body_html"),
  bodyText: text("body_text"),
  folder: text("folder", { enum: ["inbox", "sent", "drafts", "spam", "trash", "starred"] }).notNull().default("inbox"),
  read: integer("read").notNull().default(0),
  starred: integer("starred").notNull().default(0),
  hasAttachment: integer("has_attachment").notNull().default(0),
  labels: text("labels").notNull().default("[]"),
  aiSummary: text("ai_summary"),
  aiDraft: text("ai_draft"),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("emails_account_id_idx").on(table.accountId),
  index("emails_thread_id_idx").on(table.threadId),
  index("emails_folder_idx").on(table.folder),
]);

export const emailAttachments = pgTable("email_attachments", {
  id: text("id").primaryKey(),
  emailId: text("email_id").notNull().references(() => emails.id, { onDelete: "cascade" }),
  fileId: text("file_id").references(() => files.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull().default(0),
  externalId: text("external_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailLabels = pgTable("email_labels", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => emailAccounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6b7280"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
