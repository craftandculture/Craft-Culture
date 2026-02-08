CREATE TYPE "public"."wms_storage_method" AS ENUM('pallet', 'shelf', 'mixed');--> statement-breakpoint
ALTER TYPE "public"."zoho_sales_order_status" ADD VALUE 'approved' BEFORE 'picking';--> statement-breakpoint
ALTER TABLE "logistics_shipment_items" ADD COLUMN "supplier_sku" text;--> statement-breakpoint
ALTER TABLE "wms_locations" ADD COLUMN "storage_method" "wms_storage_method" DEFAULT 'shelf';--> statement-breakpoint
ALTER TABLE "wms_locations" ADD COLUMN "position" text;--> statement-breakpoint
ALTER TABLE "wms_stock" ADD COLUMN "supplier_sku" text;--> statement-breakpoint
ALTER TABLE "wms_stock_movements" ADD COLUMN "supplier_sku" text;