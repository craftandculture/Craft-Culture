ALTER TYPE "public"."logistics_document_type" ADD VALUE 'gac_invoice' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."logistics_document_type" ADD VALUE 'shipping_invoice' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."logistics_document_type" ADD VALUE 'cargo_photo' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "logistics_deleted_hillebrand_ids" (
	"hillebrand_shipment_id" integer PRIMARY KEY NOT NULL,
	"deleted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "logistics_shipments" ADD COLUMN "transit_boe_number" text;--> statement-breakpoint
ALTER TABLE "logistics_shipments" ADD COLUMN "re_export_boe_number" text;--> statement-breakpoint
ALTER TABLE "wms_repacks" ADD COLUMN "target2_lwin18" text;--> statement-breakpoint
ALTER TABLE "wms_repacks" ADD COLUMN "target2_product_name" text;--> statement-breakpoint
ALTER TABLE "wms_repacks" ADD COLUMN "target2_case_config" integer;--> statement-breakpoint
ALTER TABLE "wms_repacks" ADD COLUMN "target2_quantity_cases" integer;--> statement-breakpoint
ALTER TABLE "wms_repacks" ADD COLUMN "target2_stock_id" uuid;--> statement-breakpoint
ALTER TABLE "wms_stock" ADD COLUMN "re_export_boe_number" text;--> statement-breakpoint
ALTER TABLE "wms_stock" ADD COLUMN "photos" jsonb;--> statement-breakpoint
ALTER TABLE "wms_repacks" ADD CONSTRAINT "wms_repacks_target2_stock_id_wms_stock_id_fk" FOREIGN KEY ("target2_stock_id") REFERENCES "public"."wms_stock"("id") ON DELETE no action ON UPDATE no action;