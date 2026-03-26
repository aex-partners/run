-- Files table
CREATE TABLE IF NOT EXISTS "files" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "mime_type" text,
  "size" integer NOT NULL DEFAULT 0,
  "path" text,
  "source" text NOT NULL DEFAULT 'upload',
  "source_ref" text,
  "parent_id" text,
  "is_folder" integer NOT NULL DEFAULT 0,
  "starred" integer NOT NULL DEFAULT 0,
  "ai_indexed" integer NOT NULL DEFAULT 0,
  "public_token" text UNIQUE,
  "deleted_at" timestamp,
  "owner_id" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "files_parent_id_idx" ON "files" ("parent_id");
CREATE INDEX IF NOT EXISTS "files_owner_id_idx" ON "files" ("owner_id");
CREATE INDEX IF NOT EXISTS "files_source_idx" ON "files" ("source");

-- File shares table
CREATE TABLE IF NOT EXISTS "file_shares" (
  "id" text PRIMARY KEY NOT NULL,
  "file_id" text NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "access" text NOT NULL DEFAULT 'viewer',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "file_shares_file_id_idx" ON "file_shares" ("file_id");

-- Email accounts table
CREATE TABLE IF NOT EXISTS "email_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "integration_id" text NOT NULL REFERENCES "integrations"("id") ON DELETE CASCADE,
  "email_address" text NOT NULL,
  "display_name" text,
  "provider" text NOT NULL,
  "sync_status" text NOT NULL DEFAULT 'idle',
  "last_sync_at" timestamp,
  "sync_cursor" text,
  "owner_id" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Emails table
CREATE TABLE IF NOT EXISTS "emails" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL REFERENCES "email_accounts"("id") ON DELETE CASCADE,
  "external_id" text NOT NULL,
  "thread_id" text,
  "from_name" text NOT NULL,
  "from_email" text NOT NULL,
  "to" text NOT NULL DEFAULT '[]',
  "cc" text NOT NULL DEFAULT '[]',
  "subject" text NOT NULL DEFAULT '',
  "preview" text NOT NULL DEFAULT '',
  "body_html" text,
  "body_text" text,
  "folder" text NOT NULL DEFAULT 'inbox',
  "read" integer NOT NULL DEFAULT 0,
  "starred" integer NOT NULL DEFAULT 0,
  "has_attachment" integer NOT NULL DEFAULT 0,
  "labels" text NOT NULL DEFAULT '[]',
  "ai_summary" text,
  "ai_draft" text,
  "date" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "emails_account_id_idx" ON "emails" ("account_id");
CREATE INDEX IF NOT EXISTS "emails_thread_id_idx" ON "emails" ("thread_id");
CREATE INDEX IF NOT EXISTS "emails_folder_idx" ON "emails" ("folder");
CREATE UNIQUE INDEX IF NOT EXISTS "emails_account_external_idx" ON "emails" ("account_id", "external_id");

-- Email attachments table
CREATE TABLE IF NOT EXISTS "email_attachments" (
  "id" text PRIMARY KEY NOT NULL,
  "email_id" text NOT NULL REFERENCES "emails"("id") ON DELETE CASCADE,
  "file_id" text REFERENCES "files"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size" integer NOT NULL DEFAULT 0,
  "external_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Email labels table
CREATE TABLE IF NOT EXISTS "email_labels" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL REFERENCES "email_accounts"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "color" text NOT NULL DEFAULT '#6b7280',
  "created_at" timestamp DEFAULT now() NOT NULL
);
