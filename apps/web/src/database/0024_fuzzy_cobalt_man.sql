CREATE TYPE "public"."agent_run_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."wms_reservation_status" AS ENUM('active', 'picked', 'released');--> statement-breakpoint
ALTER TYPE "public"."wms_movement_type" ADD VALUE 'dispatch';--> statement-breakpoint
CREATE TABLE "agent_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"run_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_outputs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"status" "agent_run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "competitor_wines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_name" text NOT NULL,
	"product_name" text NOT NULL,
	"vintage" text,
	"country" text,
	"region" text,
	"bottle_size" text,
	"selling_price_aed" double precision,
	"selling_price_usd" double precision,
	"quantity" integer,
	"source" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"lwin18_match" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitor_wines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wms_cycle_count_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_count_id" uuid NOT NULL,
	"stock_id" uuid,
	"location_id" uuid NOT NULL,
	"lwin18" text NOT NULL,
	"product_name" text NOT NULL,
	"expected_quantity" integer DEFAULT 0 NOT NULL,
	"counted_quantity" integer,
	"discrepancy" integer,
	"notes" text,
	"counted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wms_stock_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_id" uuid NOT NULL,
	"order_type" text NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"lwin18" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity_cases" integer NOT NULL,
	"status" "wms_reservation_status" DEFAULT 'active' NOT NULL,
	"released_at" timestamp,
	"release_reason" text,
	"picked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wms_cycle_counts" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD CONSTRAINT "agent_outputs_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_wines" ADD CONSTRAINT "competitor_wines_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_cycle_count_items" ADD CONSTRAINT "wms_cycle_count_items_cycle_count_id_wms_cycle_counts_id_fk" FOREIGN KEY ("cycle_count_id") REFERENCES "public"."wms_cycle_counts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_cycle_count_items" ADD CONSTRAINT "wms_cycle_count_items_stock_id_wms_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."wms_stock"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_cycle_count_items" ADD CONSTRAINT "wms_cycle_count_items_location_id_wms_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."wms_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_stock_reservations" ADD CONSTRAINT "wms_stock_reservations_stock_id_wms_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."wms_stock"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_outputs_agent_id_idx" ON "agent_outputs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_outputs_run_id_idx" ON "agent_outputs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "agent_runs_agent_id_idx" ON "agent_runs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_runs_status_idx" ON "agent_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "competitor_wines_competitor_idx" ON "competitor_wines" USING btree ("competitor_name");--> statement-breakpoint
CREATE INDEX "competitor_wines_active_idx" ON "competitor_wines" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "competitor_wines_lwin18_idx" ON "competitor_wines" USING btree ("lwin18_match");--> statement-breakpoint
CREATE INDEX "wms_cycle_count_items_count_id_idx" ON "wms_cycle_count_items" USING btree ("cycle_count_id");--> statement-breakpoint
CREATE INDEX "wms_stock_reservations_stock_id_idx" ON "wms_stock_reservations" USING btree ("stock_id");--> statement-breakpoint
CREATE INDEX "wms_stock_reservations_order_id_idx" ON "wms_stock_reservations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "wms_stock_reservations_order_item_id_idx" ON "wms_stock_reservations" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "wms_stock_reservations_status_idx" ON "wms_stock_reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wms_stock_reservations_order_type_idx" ON "wms_stock_reservations" USING btree ("order_type");