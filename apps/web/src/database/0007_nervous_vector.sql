CREATE TYPE "public"."pricing_session_status" AS ENUM('draft', 'mapped', 'calculated', 'exported');--> statement-breakpoint
CREATE TABLE "lwin_reference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lwin" text NOT NULL,
	"display_name" text,
	"producer_title" text,
	"producer_name" text,
	"wine" text,
	"country" text,
	"region" text,
	"sub_region" text,
	"colour" text,
	"type" text,
	"sub_type" text,
	"vintage_config" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lwin_reference_lwin_unique" UNIQUE("lwin")
);
--> statement-breakpoint
ALTER TABLE "lwin_reference" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pricing_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"lwin" text,
	"product_name" text NOT NULL,
	"vintage" text,
	"region" text,
	"producer" text,
	"bottle_size" text,
	"case_config" integer,
	"uk_in_bond_price" double precision NOT NULL,
	"input_currency" text NOT NULL,
	"in_bond_case_usd" double precision,
	"in_bond_bottle_usd" double precision,
	"in_bond_case_aed" double precision,
	"in_bond_bottle_aed" double precision,
	"delivered_case_usd" double precision,
	"delivered_bottle_usd" double precision,
	"delivered_case_aed" double precision,
	"delivered_bottle_aed" double precision,
	"ws_avg_price" double precision,
	"ws_min_price" double precision,
	"ws_max_price" double precision,
	"ws_merchant_count" integer,
	"ws_critic_score" integer,
	"ws_link" text,
	"ws_fetched_at" timestamp,
	"has_warning" boolean DEFAULT false,
	"warning_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pricing_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pricing_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "pricing_session_status" DEFAULT 'draft' NOT NULL,
	"source_type" text NOT NULL,
	"source_file_name" text,
	"google_sheet_id" text,
	"raw_data" jsonb,
	"detected_columns" jsonb,
	"column_mapping" jsonb,
	"calculation_variables" jsonb,
	"item_count" integer DEFAULT 0,
	"errors" jsonb,
	"warnings" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pricing_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pricing_items" ADD CONSTRAINT "pricing_items_session_id_pricing_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pricing_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_sessions" ADD CONSTRAINT "pricing_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lwin_reference_lwin_idx" ON "lwin_reference" USING btree ("lwin");--> statement-breakpoint
CREATE INDEX "lwin_reference_display_name_trigram_idx" ON "lwin_reference" USING gin ("display_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "lwin_reference_wine_trigram_idx" ON "lwin_reference" USING gin ("wine" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "lwin_reference_producer_trigram_idx" ON "lwin_reference" USING gin ("producer_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "pricing_items_session_id_idx" ON "pricing_items" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "pricing_items_lwin_idx" ON "pricing_items" USING btree ("lwin");--> statement-breakpoint
CREATE INDEX "pricing_sessions_created_by_idx" ON "pricing_sessions" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "pricing_sessions_status_idx" ON "pricing_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pricing_sessions_created_at_idx" ON "pricing_sessions" USING btree ("created_at");