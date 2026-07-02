CREATE TABLE "bling_sync_map" (
	"entity_slug" text NOT NULL,
	"external_id" text NOT NULL,
	"record_id" text NOT NULL,
	"version" integer NOT NULL,
	"content_hash" text NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bling_sync_map_entity_slug_external_id_pk" PRIMARY KEY("entity_slug","external_id")
);
--> statement-breakpoint
ALTER TABLE "bling_sync_map" ADD CONSTRAINT "bling_sync_map_record_id_entity_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."entity_records"("id") ON DELETE cascade ON UPDATE no action;