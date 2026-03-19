ALTER TABLE "conversation_members" ADD COLUMN "pinned" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD COLUMN "favorite" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD COLUMN "muted" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "pinned" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "starred" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_for" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reactions" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "audio_url" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "audio_duration" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "audio_waveform" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "audio_transcription" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "audio_transcription_edited" integer DEFAULT 0;