CREATE TABLE IF NOT EXISTS "plugins" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "version" text NOT NULL,
  "author" text,
  "icon" text,
  "category" text,
  "manifest" text NOT NULL,
  "source" text DEFAULT 'registry' NOT NULL,
  "source_url" text,
  "status" text DEFAULT 'available' NOT NULL,
  "config" text DEFAULT '{}' NOT NULL,
  "installed_at" timestamp,
  "installed_by" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "plugins" ADD CONSTRAINT "plugins_installed_by_user_id_fk" FOREIGN KEY ("installed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "custom_tools" ADD COLUMN "plugin_id" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "custom_tools" ADD CONSTRAINT "custom_tools_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
