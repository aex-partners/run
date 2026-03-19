CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"avatar" text,
	"system_prompt" text NOT NULL,
	"model_id" text,
	"skill_ids" text DEFAULT '[]' NOT NULL,
	"tool_ids" text DEFAULT '[]' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "custom_tools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"input_schema" text NOT NULL,
	"output_schema" text,
	"type" text NOT NULL,
	"config" text DEFAULT '{}' NOT NULL,
	"is_read_only" boolean DEFAULT false NOT NULL,
	"integration_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_tools_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'disabled' NOT NULL,
	"config" text DEFAULT '{}' NOT NULL,
	"credentials" text DEFAULT '{}' NOT NULL,
	"webhook_secret" text,
	"created_by" text NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"system_prompt" text NOT NULL,
	"tool_ids" text DEFAULT '[]' NOT NULL,
	"system_tool_names" text DEFAULT '[]' NOT NULL,
	"guardrails" text DEFAULT '{}' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skills_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "agent_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "type" text DEFAULT 'inference' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "agent_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "tool_name" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "input_schema" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "output_schema" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "structured_input" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "workflow_execution_id" text;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_tools" ADD CONSTRAINT "custom_tools_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;