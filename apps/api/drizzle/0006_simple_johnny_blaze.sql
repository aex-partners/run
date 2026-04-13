CREATE TABLE "reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" text,
	"message" text NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"fired_at" timestamp,
	"job_id" text,
	"deliver_email" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge" ADD COLUMN "embedding" vector(1024);--> statement-breakpoint
ALTER TABLE "knowledge" ADD COLUMN "source_file_id" text;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminders_user_id_idx" ON "reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reminders_status_idx" ON "reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reminders_scheduled_for_idx" ON "reminders" USING btree ("scheduled_for");--> statement-breakpoint
ALTER TABLE "knowledge" ADD CONSTRAINT "knowledge_source_file_id_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_source_file_id_idx" ON "knowledge" USING btree ("source_file_id");