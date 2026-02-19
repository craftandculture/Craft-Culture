ALTER TYPE "public"."logistics_shipment_status" ADD VALUE 'partially_received' BEFORE 'dispatched';--> statement-breakpoint
ALTER TYPE "public"."wms_movement_type" ADD VALUE 'pallet_unseal';--> statement-breakpoint
ALTER TYPE "public"."wms_movement_type" ADD VALUE 'pallet_dissolve';--> statement-breakpoint
ALTER TYPE "public"."wms_movement_type" ADD VALUE 'pallet_dispatch';--> statement-breakpoint
CREATE INDEX "wms_stock_lwin18_location_owner_idx" ON "wms_stock" USING btree ("lwin18","location_id","owner_id");--> statement-breakpoint
CREATE INDEX "zoho_sales_orders_dispatch_batch_idx" ON "zoho_sales_orders" USING btree ("dispatch_batch_id");