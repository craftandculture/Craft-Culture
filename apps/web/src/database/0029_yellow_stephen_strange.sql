ALTER TABLE "logistics_shipment_items" ADD COLUMN "override_owner_id" uuid;--> statement-breakpoint
ALTER TABLE "logistics_shipment_items" ADD COLUMN "override_owner_name" text;--> statement-breakpoint
ALTER TABLE "zoho_sales_orders" ADD COLUMN "invoice_number" text;--> statement-breakpoint
ALTER TABLE "logistics_shipment_items" ADD CONSTRAINT "logistics_shipment_items_override_owner_id_partners_id_fk" FOREIGN KEY ("override_owner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;