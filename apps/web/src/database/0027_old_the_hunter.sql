CREATE TYPE "public"."import_price_source" AS ENUM('manual', 'shipment');--> statement-breakpoint
CREATE TABLE "wms_product_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lwin18" text NOT NULL,
	"import_price_per_bottle" double precision NOT NULL,
	"import_price_source" "import_price_source" DEFAULT 'manual' NOT NULL,
	"shipment_item_id" uuid,
	"notes" text,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wms_product_pricing_lwin18_unique" UNIQUE("lwin18")
);
--> statement-breakpoint
ALTER TABLE "wms_product_pricing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wms_product_pricing" ADD CONSTRAINT "wms_product_pricing_shipment_item_id_logistics_shipment_items_id_fk" FOREIGN KEY ("shipment_item_id") REFERENCES "public"."logistics_shipment_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_product_pricing" ADD CONSTRAINT "wms_product_pricing_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wms_product_pricing_lwin18_idx" ON "wms_product_pricing" USING btree ("lwin18");