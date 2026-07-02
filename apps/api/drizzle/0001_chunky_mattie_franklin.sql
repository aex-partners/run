ALTER TABLE "integrations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "integrations" CASCADE;--> statement-breakpoint
DROP INDEX "entity_records_external_idx";--> statement-breakpoint
ALTER TABLE "entity_records" DROP COLUMN "external_source";--> statement-breakpoint
ALTER TABLE "entity_records" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "entity_records" DROP COLUMN "last_synced_at";--> statement-breakpoint
ALTER TABLE "entity_records" DROP COLUMN "sync_state";