import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
  integer,
  boolean,
  jsonb,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  name: text("name"),
  type: text("type", { enum: ["dm", "channel", "ai"] }).notNull().default("ai"),
  agentId: text("agent_id"),
  sessionId: text("session_id"),
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
  status: text("status", { enum: ["pending", "running", "completed", "failed", "cancelled", "acknowledged"] }).notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  createdBy: text("created_by").notNull().references(() => users.id),
  result: text("result"),
  error: text("error"),
  input: text("input"),
  scheduledAt: timestamp("scheduled_at"),
  type: text("type", { enum: ["inference", "structured"] }).notNull().default("inference"),
  agentId: text("agent_id"),
  toolName: text("tool_name"),
  inputSchema: text("input_schema"),
  outputSchema: text("output_schema"),
  structuredInput: text("structured_input"),
  // Collaborative work axes: executor = who runs it, kind = semantic type.
  executor: text("executor", { enum: ["ai", "human"] }).notNull().default("ai"),
  kind: text("kind", { enum: ["task", "reminder", "approval"] }).notNull().default("task"),
  dueAt: timestamp("due_at"),
  snoozedUntil: timestamp("snoozed_until"),
  parentTaskId: text("parent_task_id"),
  approvalDecision: text("approval_decision", { enum: ["approved", "rejected"] }),
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

// Per-assignee responsibility + interaction state for a task. A task can have
// many assignees; each tracks its own seen/read/acknowledged independently.
export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    seenAt: timestamp("seen_at"),
    readAt: timestamp("read_at"),
    acknowledgedAt: timestamp("acknowledged_at"),
    snoozedUntil: timestamp("snoozed_until"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.userId] }),
    index("task_assignees_user_id_idx").on(table.userId),
  ],
);

// Conversation-independent notification surface (drives the unread badge).
export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["task_assigned", "task_acknowledged", "reminder_fired", "approval_requested", "approval_decided"],
    }).notNull(),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_read_idx").on(table.userId, table.readAt),
  ],
);

// Per-user notification settings. An absent row is treated as default-enabled
// everywhere (the digest worker LEFT JOINs and coalesces), so a freshly created
// user gets digests without a backfill being strictly required at runtime.
// lastDigestSentAt bounds the unread window and makes BullMQ retries idempotent:
// the worker only includes notifications newer than this stamp and advances it
// per user after a successful send.
export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  emailDigest: boolean("email_digest").notNull().default(true),
  lastDigestSentAt: timestamp("last_digest_sent_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
  // Optimistic-concurrency token: incremented on every write via compare-and-set
  // to prevent lost updates from concurrent manual/AI edits.
  version: integer("version").notNull().default(0),
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

// Per-user + per-entity view preferences for the database screen. activeView is
// the last selected view (table/kanban/calendar/form/gallery/map); config is a
// JSON blob holding per-view settings (column order/hidden/pinned, gallery image
// column, map lat/lng/address columns, etc.). An absent row means defaults. The
// unique (user, entity) constraint backs an upsert that merges config.
export const userViewPreferences = pgTable("user_view_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entityId: text("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  activeView: text("active_view"),
  config: text("config").notNull().default("{}"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_view_prefs_user_entity_idx").on(table.userId, table.entityId),
]);

// Named "saved views" for the database screen: a bundle of filter + arrangement +
// view type stored under one name, owned by a user. isPublic=1 makes the view
// visible to every authed user of that entity; non-owners apply it read-only and
// can clone it into their own private copy (only the owner edits/deletes the
// original). filters is a JSON FilterCondition[]; config is a JSON arrangement blob
// (column order/hidden/pinned, sort, per-view settings), same shape as
// userViewPreferences.config.
export const savedViews = pgTable("saved_views", {
  id: text("id").primaryKey(),
  entityId: text("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isPublic: integer("is_public").notNull().default(0),
  viewType: text("view_type").notNull().default("table"),
  filters: text("filters").notNull().default("[]"),
  config: text("config").notNull().default("{}"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("saved_views_entity_id_idx").on(table.entityId),
  index("saved_views_owner_id_idx").on(table.ownerId),
]);

// Geocode cache for the map view. Keyed by a normalized address query so repeated
// renders never re-hit the geocoding provider (Nominatim: 1 req/s, no bulk). A
// null lat/lng row records a confirmed miss to avoid re-querying unresolvable
// addresses.
export const geocodeCache = pgTable("geocode_cache", {
  query: text("query").primaryKey(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  provider: text("provider").notNull().default("nominatim"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
  status: text("status", { enum: ["pending", "running", "succeeded", "failed", "paused", "stopped"] }).notNull().default("pending"),
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
  // Bot user backing this agent so it can act as a first-class task actor.
  userId: text("user_id").references(() => users.id),
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
  isPrimary: boolean("is_primary").notNull().default(false),
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
  displayName: text("display_name").notNull(),
  emailAddress: text("email_address").notNull(),
  fromName: text("from_name"),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull().default(587),
  smtpUser: text("smtp_user").notNull(),
  smtpPass: text("smtp_pass").notNull(),
  smtpSecure: integer("smtp_secure").notNull().default(1),
  imapHost: text("imap_host"),
  imapPort: integer("imap_port").default(993),
  imapUser: text("imap_user"),
  imapPass: text("imap_pass"),
  imapSecure: integer("imap_secure").default(1),
  lastSyncAt: timestamp("last_sync_at"),
  isShared: integer("is_shared").notNull().default(0),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const mailAccountMembers = pgTable("mail_account_members", {
  accountId: text("account_id").notNull().references(() => emailAccounts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  canSend: integer("can_send").notNull().default(1),
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.accountId, table.userId] }),
  index("mail_account_members_user_id_idx").on(table.userId),
]);

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
  folder: text("folder", { enum: ["inbox", "sent", "drafts", "spam", "trash", "starred", "archive"] }).notNull().default("inbox"),
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

export const messageEmbeddings = pgTable(
  "message_embeddings",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    role: text("role").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("message_embeddings_conversation_id_idx").on(table.conversationId),
  ],
);

// Reminders: persistent scheduled reminders surfaced via chat + optional email.
// A BullMQ delayed job keyed by reminder id fires at `scheduledFor` and posts
// the reminder as an AI message into the originating conversation.
export const reminders = pgTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    message: text("message").notNull(),
    scheduledFor: timestamp("scheduled_for").notNull(),
    status: text("status", { enum: ["scheduled", "fired", "cancelled"] }).notNull().default("scheduled"),
    firedAt: timestamp("fired_at"),
    jobId: text("job_id"),
    deliverEmail: integer("deliver_email").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("reminders_user_id_idx").on(table.userId),
    index("reminders_status_idx").on(table.status),
    index("reminders_scheduled_for_idx").on(table.scheduledFor),
  ],
);

// Knowledge: persistent memory for the AI agent
// scope: "company" (shared, all users see) | "personal" (only the user who created it)
export const knowledge = pgTable(
  "knowledge",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull().default("company"), // "company" | "personal"
    category: text("category").notNull(), // e.g. "company-info", "client", "product", "process", "preference"
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdBy: text("created_by").references(() => users.id),
    embedding: vector("embedding", { dimensions: 1024 }),
    sourceFileId: text("source_file_id").references(() => files.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("knowledge_scope_idx").on(table.scope),
    index("knowledge_category_idx").on(table.category),
    index("knowledge_created_by_idx").on(table.createdBy),
    index("knowledge_source_file_id_idx").on(table.sourceFileId),
  ],
);

// Append-only security/compliance audit trail. One row per security-relevant
// admin action (user lifecycle, settings, credentials) plus GDPR events (W4
// data-export feature writes here via the same logAuditEvent helper).
//
// actorEmail is a denormalized snapshot of who acted, taken at write time, so
// attribution survives the actor being deleted: the actorId FK is set null on
// actor deletion for referential cleanliness, but the email persists in the row.
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(), // e.g. "user.role_changed", "settings.changed"
    resourceType: text("resource_type").notNull(), // e.g. "user", "settings", "credential"
    resourceId: text("resource_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_actor_id_idx").on(table.actorId),
    index("audit_log_created_at_idx").on(table.createdAt),
    index("audit_log_resource_idx").on(table.resourceType, table.resourceId),
  ],
);
