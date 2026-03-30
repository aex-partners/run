CREATE TABLE "credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"plugin_name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"value" text DEFAULT '{}' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"email_address" text NOT NULL,
	"from_name" text,
	"smtp_host" text NOT NULL,
	"smtp_port" integer DEFAULT 587 NOT NULL,
	"smtp_user" text NOT NULL,
	"smtp_pass" text NOT NULL,
	"smtp_secure" integer DEFAULT 1 NOT NULL,
	"imap_host" text,
	"imap_port" integer DEFAULT 993,
	"imap_user" text,
	"imap_pass" text,
	"imap_secure" integer DEFAULT 1,
	"last_sync_at" timestamp,
	"is_shared" integer DEFAULT 0 NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"email_id" text NOT NULL,
	"file_id" text,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"external_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_labels" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"external_id" text NOT NULL,
	"thread_id" text,
	"from_name" text NOT NULL,
	"from_email" text NOT NULL,
	"to" text DEFAULT '[]' NOT NULL,
	"cc" text DEFAULT '[]' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"preview" text DEFAULT '' NOT NULL,
	"body_html" text,
	"body_text" text,
	"folder" text DEFAULT 'inbox' NOT NULL,
	"read" integer DEFAULT 0 NOT NULL,
	"starred" integer DEFAULT 0 NOT NULL,
	"has_attachment" integer DEFAULT 0 NOT NULL,
	"labels" text DEFAULT '[]' NOT NULL,
	"ai_summary" text,
	"ai_draft" text,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"mime_type" text,
	"size" integer DEFAULT 0 NOT NULL,
	"path" text,
	"source" text DEFAULT 'upload' NOT NULL,
	"source_ref" text,
	"parent_id" text,
	"is_folder" integer DEFAULT 0 NOT NULL,
	"starred" integer DEFAULT 0 NOT NULL,
	"ai_indexed" integer DEFAULT 0 NOT NULL,
	"public_token" text,
	"deleted_at" timestamp,
	"owner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "files_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "flow_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"flow_id" text NOT NULL,
	"flow_version_id" text,
	"status" text DEFAULT 'running' NOT NULL,
	"triggered_by" text,
	"trigger_payload" text,
	"steps" text DEFAULT '{}' NOT NULL,
	"duration" integer,
	"tags" text DEFAULT '[]' NOT NULL,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"flow_id" text NOT NULL,
	"display_name" text NOT NULL,
	"trigger" text DEFAULT '{}' NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"valid" boolean DEFAULT false NOT NULL,
	"schema_version" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flows" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'disabled' NOT NULL,
	"folder_id" text,
	"published_version_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text DEFAULT 'company' NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_account_members" (
	"account_id" text NOT NULL,
	"user_id" text NOT NULL,
	"can_send" integer DEFAULT 1 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail_account_members_account_id_user_id_pk" PRIMARY KEY("account_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "message_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"content" text NOT NULL,
	"role" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_store" (
	"id" text PRIMARY KEY NOT NULL,
	"plugin_name" text NOT NULL,
	"scope" text DEFAULT 'project' NOT NULL,
	"scope_id" text,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugins" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"version" text NOT NULL,
	"author" text,
	"icon" text,
	"category" text,
	"manifest" text,
	"piece_name" text,
	"auth_type" text,
	"source" text DEFAULT 'registry' NOT NULL,
	"source_url" text,
	"status" text DEFAULT 'available' NOT NULL,
	"config" text DEFAULT '{}' NOT NULL,
	"installed_at" timestamp,
	"installed_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "custom_tools" ADD COLUMN "plugin_id" text;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_labels" ADD CONSTRAINT "email_labels_account_id_email_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_account_id_email_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_runs" ADD CONSTRAINT "flow_runs_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_runs" ADD CONSTRAINT "flow_runs_flow_version_id_flow_versions_id_fk" FOREIGN KEY ("flow_version_id") REFERENCES "public"."flow_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_versions" ADD CONSTRAINT "flow_versions_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_folder_id_flow_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."flow_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge" ADD CONSTRAINT "knowledge_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_account_members" ADD CONSTRAINT "mail_account_members_account_id_email_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_account_members" ADD CONSTRAINT "mail_account_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_embeddings" ADD CONSTRAINT "message_embeddings_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_embeddings" ADD CONSTRAINT "message_embeddings_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugins" ADD CONSTRAINT "plugins_installed_by_users_id_fk" FOREIGN KEY ("installed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "emails_account_id_idx" ON "emails" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "emails_thread_id_idx" ON "emails" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "emails_folder_idx" ON "emails" USING btree ("folder");--> statement-breakpoint
CREATE INDEX "file_shares_file_id_idx" ON "file_shares" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "files_parent_id_idx" ON "files" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "files_owner_id_idx" ON "files" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "files_source_idx" ON "files" USING btree ("source");--> statement-breakpoint
CREATE INDEX "flow_runs_flow_id_idx" ON "flow_runs" USING btree ("flow_id");--> statement-breakpoint
CREATE INDEX "flow_runs_status_idx" ON "flow_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "flow_versions_flow_id_idx" ON "flow_versions" USING btree ("flow_id");--> statement-breakpoint
CREATE INDEX "knowledge_scope_idx" ON "knowledge" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "knowledge_category_idx" ON "knowledge" USING btree ("category");--> statement-breakpoint
CREATE INDEX "knowledge_created_by_idx" ON "knowledge" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "mail_account_members_user_id_idx" ON "mail_account_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_embeddings_conversation_id_idx" ON "message_embeddings" USING btree ("conversation_id");--> statement-breakpoint
ALTER TABLE "custom_tools" ADD CONSTRAINT "custom_tools_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;