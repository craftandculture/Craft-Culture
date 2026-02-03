CREATE TYPE "public"."wms_receiving_draft_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "wms_receiving_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"items" jsonb NOT NULL,
	"notes" text,
	"status" "wms_receiving_draft_status" DEFAULT 'in_progress',
	"last_modified_by" uuid,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wms_receiving_drafts_shipment_id_unique" UNIQUE("shipment_id")
);
--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "zoho_contact_id" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "zoho_vendor_id" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "zoho_last_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "zoho_invoice_id" text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "zoho_invoice_number" text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "zoho_invoice_status" text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "zoho_last_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "wms_receiving_drafts" ADD CONSTRAINT "wms_receiving_drafts_shipment_id_logistics_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."logistics_shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_receiving_drafts" ADD CONSTRAINT "wms_receiving_drafts_last_modified_by_users_id_fk" FOREIGN KEY ("last_modified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wms_receiving_drafts_shipment_id_idx" ON "wms_receiving_drafts" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "wms_receiving_drafts_status_idx" ON "wms_receiving_drafts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "wms_stock_lwin18_location_shipment_unique" ON "wms_stock" USING btree ("lwin18","location_id","shipment_id");