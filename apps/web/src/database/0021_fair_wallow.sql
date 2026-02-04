CREATE TYPE "public"."zoho_sales_order_status" AS ENUM('synced', 'picking', 'picked', 'dispatched', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TABLE "zoho_sales_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"zoho_line_item_id" text NOT NULL,
	"zoho_item_id" text,
	"sku" text,
	"name" text NOT NULL,
	"description" text,
	"rate" double precision NOT NULL,
	"quantity" integer NOT NULL,
	"quantity_picked" integer DEFAULT 0,
	"quantity_shipped" integer DEFAULT 0,
	"unit" text,
	"discount" double precision,
	"item_total" double precision NOT NULL,
	"lwin18" text,
	"stock_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zoho_sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zoho_salesorder_id" text NOT NULL,
	"salesorder_number" text NOT NULL,
	"zoho_customer_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"zoho_status" text NOT NULL,
	"status" "zoho_sales_order_status" DEFAULT 'synced',
	"order_date" date NOT NULL,
	"shipment_date" date,
	"reference_number" text,
	"sub_total" double precision NOT NULL,
	"total" double precision NOT NULL,
	"currency_code" text DEFAULT 'USD',
	"shipping_charge" double precision,
	"discount" double precision,
	"notes" text,
	"billing_address" jsonb,
	"shipping_address" jsonb,
	"pick_list_id" uuid,
	"dispatch_batch_id" uuid,
	"zoho_created_time" timestamp,
	"zoho_last_modified_time" timestamp,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "zoho_sales_orders_zoho_salesorder_id_unique" UNIQUE("zoho_salesorder_id")
);
--> statement-breakpoint
ALTER TABLE "zoho_sales_order_items" ADD CONSTRAINT "zoho_sales_order_items_sales_order_id_zoho_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."zoho_sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_sales_order_items" ADD CONSTRAINT "zoho_sales_order_items_stock_id_wms_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."wms_stock"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_sales_orders" ADD CONSTRAINT "zoho_sales_orders_pick_list_id_wms_pick_lists_id_fk" FOREIGN KEY ("pick_list_id") REFERENCES "public"."wms_pick_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_sales_orders" ADD CONSTRAINT "zoho_sales_orders_dispatch_batch_id_wms_dispatch_batches_id_fk" FOREIGN KEY ("dispatch_batch_id") REFERENCES "public"."wms_dispatch_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "zoho_sales_order_items_order_idx" ON "zoho_sales_order_items" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "zoho_sales_orders_zoho_id_idx" ON "zoho_sales_orders" USING btree ("zoho_salesorder_id");--> statement-breakpoint
CREATE INDEX "zoho_sales_orders_status_idx" ON "zoho_sales_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zoho_sales_orders_customer_idx" ON "zoho_sales_orders" USING btree ("zoho_customer_id");