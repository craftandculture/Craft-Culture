CREATE TYPE "public"."exchange_order_status" AS ENUM('pending', 'confirmed', 'paid', 'picking', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'payment_received', 'settled');--> statement-breakpoint
CREATE TYPE "public"."supplier_payout_status" AS ENUM('pending', 'processing', 'paid');--> statement-breakpoint
CREATE TYPE "public"."supplier_product_status" AS ENUM('incoming', 'available', 'low_stock', 'sold_out');--> statement-breakpoint
CREATE TYPE "public"."supplier_shipment_status" AS ENUM('draft', 'submitted', 'in_transit', 'arrived', 'checked_in', 'issues');--> statement-breakpoint
CREATE TYPE "public"."wms_cycle_count_status" AS ENUM('pending', 'in_progress', 'completed', 'reconciled');--> statement-breakpoint
CREATE TYPE "public"."wms_dispatch_batch_status" AS ENUM('draft', 'picking', 'staged', 'dispatched', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."wms_location_type" AS ENUM('rack', 'floor', 'receiving', 'shipping');--> statement-breakpoint
CREATE TYPE "public"."wms_movement_type" AS ENUM('receive', 'putaway', 'transfer', 'pick', 'adjust', 'count', 'ownership_transfer', 'repack_out', 'repack_in', 'pallet_add', 'pallet_remove', 'pallet_move');--> statement-breakpoint
CREATE TYPE "public"."wms_pallet_status" AS ENUM('active', 'sealed', 'retrieved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."wms_pick_list_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."wms_request_status" AS ENUM('pending', 'approved', 'rejected', 'completed');--> statement-breakpoint
CREATE TYPE "public"."wms_request_type" AS ENUM('transfer', 'mark_for_sale', 'withdrawal');--> statement-breakpoint
ALTER TYPE "public"."order_item_stock_status" ADD VALUE 'at_cc_ready_for_dispatch' BEFORE 'in_transit_to_distributor';--> statement-breakpoint
ALTER TYPE "public"."partner_type" ADD VALUE 'supplier';--> statement-breakpoint
CREATE TABLE "consignment_settlement_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"lwin18" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity_cases" integer NOT NULL,
	"unit_price" double precision NOT NULL,
	"line_total" double precision NOT NULL,
	"stock_id" uuid,
	"lot_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consignment_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_number" text NOT NULL,
	"order_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"zoho_invoice_id" text,
	"zoho_invoice_number" text,
	"zoho_bill_id" text,
	"owner_id" uuid NOT NULL,
	"owner_name" text NOT NULL,
	"sale_amount" double precision NOT NULL,
	"commission_percent" double precision NOT NULL,
	"commission_amount" double precision NOT NULL,
	"owed_to_owner" double precision NOT NULL,
	"currency" text DEFAULT 'USD',
	"status" "settlement_status" DEFAULT 'pending',
	"invoice_paid_at" timestamp,
	"settled_at" timestamp,
	"settled_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "consignment_settlements_settlement_number_unique" UNIQUE("settlement_number")
);
--> statement-breakpoint
CREATE TABLE "exchange_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"supplier_product_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_usd" double precision NOT NULL,
	"line_total_usd" double precision NOT NULL,
	"supplier_cost_eur" double precision NOT NULL,
	"product_name" text NOT NULL,
	"product_vintage" text,
	"product_region" text,
	"case_size" integer NOT NULL,
	"bottle_size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exchange_order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exchange_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"buyer_id" uuid NOT NULL,
	"placed_by" uuid NOT NULL,
	"status" "exchange_order_status" DEFAULT 'pending' NOT NULL,
	"subtotal_usd" double precision DEFAULT 0 NOT NULL,
	"delivery_fee_usd" double precision DEFAULT 0 NOT NULL,
	"total_usd" double precision DEFAULT 0 NOT NULL,
	"delivery_address" text,
	"delivery_notes" text,
	"buyer_notes" text,
	"internal_notes" text,
	"placed_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"paid_at" timestamp,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
ALTER TABLE "exchange_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplier_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_number" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"gross_sales_eur" double precision DEFAULT 0 NOT NULL,
	"commission_eur" double precision DEFAULT 0 NOT NULL,
	"commission_rate" double precision NOT NULL,
	"net_payout_eur" double precision DEFAULT 0 NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"status" "supplier_payout_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"payment_reference" text,
	"processed_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_payouts_payout_number_unique" UNIQUE("payout_number")
);
--> statement-breakpoint
ALTER TABLE "supplier_payouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplier_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"supplier_sku" text,
	"cost_price_eur" double precision NOT NULL,
	"cases_consigned" integer DEFAULT 0 NOT NULL,
	"cases_available" integer DEFAULT 0 NOT NULL,
	"cases_sold" integer DEFAULT 0 NOT NULL,
	"cases_reserved" integer DEFAULT 0 NOT NULL,
	"status" "supplier_product_status" DEFAULT 'incoming' NOT NULL,
	"low_stock_threshold" integer DEFAULT 3,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplier_shipment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"product_id" uuid,
	"supplier_product_id" uuid,
	"product_name" text NOT NULL,
	"producer" text,
	"vintage" text,
	"region" text,
	"country" text,
	"case_size" integer DEFAULT 12 NOT NULL,
	"bottle_size" integer DEFAULT 750 NOT NULL,
	"cases_expected" integer NOT NULL,
	"cases_received" integer,
	"cost_price_eur" double precision NOT NULL,
	"lwin7" text,
	"lwin11" text,
	"match_confidence" double precision,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_shipment_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplier_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_number" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "supplier_shipment_status" DEFAULT 'draft' NOT NULL,
	"tracking_number" text,
	"carrier" text,
	"expected_arrival" timestamp,
	"actual_arrival" timestamp,
	"checked_in_at" timestamp,
	"checked_in_by" uuid,
	"total_cases" integer DEFAULT 0 NOT NULL,
	"total_products" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"issue_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_shipments_shipment_number_unique" UNIQUE("shipment_number")
);
--> statement-breakpoint
ALTER TABLE "supplier_shipments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wms_case_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barcode" text NOT NULL,
	"lwin18" text NOT NULL,
	"product_name" text NOT NULL,
	"lot_number" text,
	"shipment_id" uuid,
	"current_location_id" uuid,
	"is_active" boolean DEFAULT true,
	"printed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wms_case_labels_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "wms_cycle_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"count_number" text NOT NULL,
	"location_id" uuid,
	"status" "wms_cycle_count_status" DEFAULT 'pending',
	"expected_items" integer DEFAULT 0,
	"counted_items" integer DEFAULT 0,
	"discrepancy_count" integer DEFAULT 0,
	"created_by" uuid,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wms_cycle_counts_count_number_unique" UNIQUE("count_number")
);
--> statement-breakpoint
CREATE TABLE "wms_delivery_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_note_number" text NOT NULL,
	"batch_id" uuid NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"total_cases" integer DEFAULT 0 NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"generated_by" uuid NOT NULL,
	"pdf_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wms_delivery_notes_delivery_note_number_unique" UNIQUE("delivery_note_number")
);
--> statement-breakpoint
CREATE TABLE "wms_dispatch_batch_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"delivery_note_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wms_dispatch_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_number" text NOT NULL,
	"status" "wms_dispatch_batch_status" DEFAULT 'draft',
	"distributor_id" uuid NOT NULL,
	"distributor_name" text NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"total_cases" integer DEFAULT 0 NOT NULL,
	"pallet_count" integer DEFAULT 1,
	"estimated_weight_kg" double precision,
	"delivery_notes" text,
	"pick_list_id" uuid,
	"dispatched_at" timestamp,
	"dispatched_by" uuid,
	"delivered_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wms_dispatch_batches_batch_number_unique" UNIQUE("batch_number")
);
--> statement-breakpoint
CREATE TABLE "wms_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_code" text NOT NULL,
	"aisle" text NOT NULL,
	"bay" text NOT NULL,
	"level" text NOT NULL,
	"location_type" "wms_location_type" NOT NULL,
	"capacity_cases" integer,
	"requires_forklift" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"barcode" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wms_locations_location_code_unique" UNIQUE("location_code"),
	CONSTRAINT "wms_locations_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "wms_pallet_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pallet_id" uuid NOT NULL,
	"case_label_id" uuid NOT NULL,
	"lwin18" text NOT NULL,
	"product_name" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"added_by" uuid NOT NULL,
	"removed_at" timestamp,
	"removed_by" uuid,
	"removal_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wms_pallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pallet_code" text NOT NULL,
	"barcode" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_name" text NOT NULL,
	"location_id" uuid,
	"total_cases" integer DEFAULT 0 NOT NULL,
	"storage_type" text DEFAULT 'customer_storage',
	"monthly_storage_fee" double precision,
	"fee_type" text DEFAULT 'per_case',
	"status" "wms_pallet_status" DEFAULT 'active',
	"is_sealed" boolean DEFAULT false,
	"sealed_at" timestamp,
	"sealed_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wms_pallets_pallet_code_unique" UNIQUE("pallet_code"),
	CONSTRAINT "wms_pallets_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "wms_partner_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_number" text NOT NULL,
	"request_type" "wms_request_type" NOT NULL,
	"status" "wms_request_status" DEFAULT 'pending',
	"partner_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"stock_id" uuid,
	"lwin18" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity_cases" integer NOT NULL,
	"target_location_id" uuid,
	"partner_notes" text,
	"admin_notes" text,
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wms_partner_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "wms_pick_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pick_list_id" uuid NOT NULL,
	"lwin18" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity_cases" integer NOT NULL,
	"suggested_location_id" uuid,
	"suggested_stock_id" uuid,
	"picked_from_location_id" uuid,
	"picked_quantity" integer,
	"picked_at" timestamp,
	"picked_by" uuid,
	"is_picked" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wms_pick_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pick_list_number" text NOT NULL,
	"status" "wms_pick_list_status" DEFAULT 'pending',
	"order_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"picked_items" integer DEFAULT 0 NOT NULL,
	"assigned_to" uuid,
	"started_at" timestamp,
	"completed_at" timestamp,
	"completed_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wms_pick_lists_pick_list_number_unique" UNIQUE("pick_list_number")
);
--> statement-breakpoint
CREATE TABLE "wms_repacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repack_number" text NOT NULL,
	"source_lwin18" text NOT NULL,
	"source_product_name" text NOT NULL,
	"source_case_config" integer NOT NULL,
	"source_quantity_cases" integer NOT NULL,
	"source_stock_id" uuid,
	"target_lwin18" text NOT NULL,
	"target_product_name" text NOT NULL,
	"target_case_config" integer NOT NULL,
	"target_quantity_cases" integer NOT NULL,
	"target_stock_id" uuid,
	"location_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"performed_by" uuid NOT NULL,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wms_repacks_repack_number_unique" UNIQUE("repack_number")
);
--> statement-breakpoint
CREATE TABLE "wms_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_name" text NOT NULL,
	"lwin18" text NOT NULL,
	"product_name" text NOT NULL,
	"producer" text,
	"vintage" integer,
	"bottle_size" text DEFAULT '750ml',
	"case_config" integer DEFAULT 12,
	"quantity_cases" integer DEFAULT 0 NOT NULL,
	"reserved_cases" integer DEFAULT 0 NOT NULL,
	"available_cases" integer DEFAULT 0 NOT NULL,
	"lot_number" text,
	"received_at" timestamp,
	"shipment_id" uuid,
	"sales_arrangement" text DEFAULT 'consignment',
	"consignment_commission_percent" double precision,
	"expiry_date" timestamp,
	"is_perishable" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wms_stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_number" text NOT NULL,
	"movement_type" "wms_movement_type" NOT NULL,
	"lwin18" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity_cases" integer NOT NULL,
	"from_location_id" uuid,
	"to_location_id" uuid,
	"from_owner_id" uuid,
	"to_owner_id" uuid,
	"lot_number" text,
	"shipment_id" uuid,
	"order_id" uuid,
	"scanned_barcodes" jsonb,
	"notes" text,
	"reason_code" text,
	"performed_by" uuid NOT NULL,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wms_stock_movements_movement_number_unique" UNIQUE("movement_number")
);
--> statement-breakpoint
CREATE TABLE "wms_storage_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_number" text NOT NULL,
	"pallet_id" uuid,
	"owner_id" uuid NOT NULL,
	"owner_name" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"case_count" integer NOT NULL,
	"pallet_count" integer DEFAULT 1 NOT NULL,
	"rate_per_unit" double precision NOT NULL,
	"rate_type" text NOT NULL,
	"total_amount" double precision NOT NULL,
	"currency" text DEFAULT 'USD',
	"invoiced" boolean DEFAULT false,
	"zoho_invoice_id" text,
	"paid_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wms_storage_charges_charge_number_unique" UNIQUE("charge_number")
);
--> statement-breakpoint
ALTER TABLE "logistics_shipment_items" ADD COLUMN "lwin" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "partner_id" uuid;--> statement-breakpoint
ALTER TABLE "consignment_settlement_items" ADD CONSTRAINT "consignment_settlement_items_settlement_id_consignment_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."consignment_settlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignment_settlement_items" ADD CONSTRAINT "consignment_settlement_items_stock_id_wms_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."wms_stock"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignment_settlements" ADD CONSTRAINT "consignment_settlements_owner_id_partners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignment_settlements" ADD CONSTRAINT "consignment_settlements_settled_by_users_id_fk" FOREIGN KEY ("settled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_order_items" ADD CONSTRAINT "exchange_order_items_order_id_exchange_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."exchange_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_order_items" ADD CONSTRAINT "exchange_order_items_supplier_product_id_supplier_products_id_fk" FOREIGN KEY ("supplier_product_id") REFERENCES "public"."supplier_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_order_items" ADD CONSTRAINT "exchange_order_items_supplier_id_partners_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_orders" ADD CONSTRAINT "exchange_orders_buyer_id_partners_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_orders" ADD CONSTRAINT "exchange_orders_placed_by_users_id_fk" FOREIGN KEY ("placed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payouts" ADD CONSTRAINT "supplier_payouts_supplier_id_partners_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payouts" ADD CONSTRAINT "supplier_payouts_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_partners_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_shipment_items" ADD CONSTRAINT "supplier_shipment_items_shipment_id_supplier_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."supplier_shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_shipment_items" ADD CONSTRAINT "supplier_shipment_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_shipment_items" ADD CONSTRAINT "supplier_shipment_items_supplier_product_id_supplier_products_id_fk" FOREIGN KEY ("supplier_product_id") REFERENCES "public"."supplier_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_shipments" ADD CONSTRAINT "supplier_shipments_supplier_id_partners_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_shipments" ADD CONSTRAINT "supplier_shipments_checked_in_by_users_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_case_labels" ADD CONSTRAINT "wms_case_labels_shipment_id_logistics_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."logistics_shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_case_labels" ADD CONSTRAINT "wms_case_labels_current_location_id_wms_locations_id_fk" FOREIGN KEY ("current_location_id") REFERENCES "public"."wms_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_cycle_counts" ADD CONSTRAINT "wms_cycle_counts_location_id_wms_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."wms_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_cycle_counts" ADD CONSTRAINT "wms_cycle_counts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_delivery_notes" ADD CONSTRAINT "wms_delivery_notes_batch_id_wms_dispatch_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."wms_dispatch_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_delivery_notes" ADD CONSTRAINT "wms_delivery_notes_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_dispatch_batch_orders" ADD CONSTRAINT "wms_dispatch_batch_orders_batch_id_wms_dispatch_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."wms_dispatch_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_dispatch_batch_orders" ADD CONSTRAINT "wms_dispatch_batch_orders_delivery_note_id_wms_delivery_notes_id_fk" FOREIGN KEY ("delivery_note_id") REFERENCES "public"."wms_delivery_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_dispatch_batches" ADD CONSTRAINT "wms_dispatch_batches_distributor_id_partners_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_dispatch_batches" ADD CONSTRAINT "wms_dispatch_batches_pick_list_id_wms_pick_lists_id_fk" FOREIGN KEY ("pick_list_id") REFERENCES "public"."wms_pick_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_dispatch_batches" ADD CONSTRAINT "wms_dispatch_batches_dispatched_by_users_id_fk" FOREIGN KEY ("dispatched_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pallet_cases" ADD CONSTRAINT "wms_pallet_cases_pallet_id_wms_pallets_id_fk" FOREIGN KEY ("pallet_id") REFERENCES "public"."wms_pallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pallet_cases" ADD CONSTRAINT "wms_pallet_cases_case_label_id_wms_case_labels_id_fk" FOREIGN KEY ("case_label_id") REFERENCES "public"."wms_case_labels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pallet_cases" ADD CONSTRAINT "wms_pallet_cases_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pallet_cases" ADD CONSTRAINT "wms_pallet_cases_removed_by_users_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pallets" ADD CONSTRAINT "wms_pallets_owner_id_partners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pallets" ADD CONSTRAINT "wms_pallets_location_id_wms_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."wms_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pallets" ADD CONSTRAINT "wms_pallets_sealed_by_users_id_fk" FOREIGN KEY ("sealed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_partner_requests" ADD CONSTRAINT "wms_partner_requests_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_partner_requests" ADD CONSTRAINT "wms_partner_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_partner_requests" ADD CONSTRAINT "wms_partner_requests_stock_id_wms_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."wms_stock"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_partner_requests" ADD CONSTRAINT "wms_partner_requests_target_location_id_wms_locations_id_fk" FOREIGN KEY ("target_location_id") REFERENCES "public"."wms_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_partner_requests" ADD CONSTRAINT "wms_partner_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pick_list_items" ADD CONSTRAINT "wms_pick_list_items_pick_list_id_wms_pick_lists_id_fk" FOREIGN KEY ("pick_list_id") REFERENCES "public"."wms_pick_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pick_list_items" ADD CONSTRAINT "wms_pick_list_items_suggested_location_id_wms_locations_id_fk" FOREIGN KEY ("suggested_location_id") REFERENCES "public"."wms_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pick_list_items" ADD CONSTRAINT "wms_pick_list_items_suggested_stock_id_wms_stock_id_fk" FOREIGN KEY ("suggested_stock_id") REFERENCES "public"."wms_stock"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pick_list_items" ADD CONSTRAINT "wms_pick_list_items_picked_from_location_id_wms_locations_id_fk" FOREIGN KEY ("picked_from_location_id") REFERENCES "public"."wms_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pick_list_items" ADD CONSTRAINT "wms_pick_list_items_picked_by_users_id_fk" FOREIGN KEY ("picked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pick_lists" ADD CONSTRAINT "wms_pick_lists_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_pick_lists" ADD CONSTRAINT "wms_pick_lists_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_repacks" ADD CONSTRAINT "wms_repacks_source_stock_id_wms_stock_id_fk" FOREIGN KEY ("source_stock_id") REFERENCES "public"."wms_stock"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_repacks" ADD CONSTRAINT "wms_repacks_target_stock_id_wms_stock_id_fk" FOREIGN KEY ("target_stock_id") REFERENCES "public"."wms_stock"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_repacks" ADD CONSTRAINT "wms_repacks_location_id_wms_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."wms_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_repacks" ADD CONSTRAINT "wms_repacks_owner_id_partners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_repacks" ADD CONSTRAINT "wms_repacks_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_stock" ADD CONSTRAINT "wms_stock_location_id_wms_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."wms_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_stock" ADD CONSTRAINT "wms_stock_owner_id_partners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_stock" ADD CONSTRAINT "wms_stock_shipment_id_logistics_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."logistics_shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_stock_movements" ADD CONSTRAINT "wms_stock_movements_from_location_id_wms_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."wms_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_stock_movements" ADD CONSTRAINT "wms_stock_movements_to_location_id_wms_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."wms_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_stock_movements" ADD CONSTRAINT "wms_stock_movements_from_owner_id_partners_id_fk" FOREIGN KEY ("from_owner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_stock_movements" ADD CONSTRAINT "wms_stock_movements_to_owner_id_partners_id_fk" FOREIGN KEY ("to_owner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_stock_movements" ADD CONSTRAINT "wms_stock_movements_shipment_id_logistics_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."logistics_shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_stock_movements" ADD CONSTRAINT "wms_stock_movements_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_storage_charges" ADD CONSTRAINT "wms_storage_charges_pallet_id_wms_pallets_id_fk" FOREIGN KEY ("pallet_id") REFERENCES "public"."wms_pallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_storage_charges" ADD CONSTRAINT "wms_storage_charges_owner_id_partners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consignment_settlement_items_settlement_id_idx" ON "consignment_settlement_items" USING btree ("settlement_id");--> statement-breakpoint
CREATE INDEX "consignment_settlements_owner_id_idx" ON "consignment_settlements" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "consignment_settlements_status_idx" ON "consignment_settlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "consignment_settlements_order_id_idx" ON "consignment_settlements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "exchange_order_items_order_id_idx" ON "exchange_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "exchange_order_items_supplier_product_id_idx" ON "exchange_order_items" USING btree ("supplier_product_id");--> statement-breakpoint
CREATE INDEX "exchange_order_items_supplier_id_idx" ON "exchange_order_items" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "exchange_orders_order_number_idx" ON "exchange_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "exchange_orders_buyer_id_idx" ON "exchange_orders" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "exchange_orders_status_idx" ON "exchange_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "exchange_orders_placed_at_idx" ON "exchange_orders" USING btree ("placed_at");--> statement-breakpoint
CREATE INDEX "supplier_payouts_payout_number_idx" ON "supplier_payouts" USING btree ("payout_number");--> statement-breakpoint
CREATE INDEX "supplier_payouts_supplier_id_idx" ON "supplier_payouts" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_payouts_status_idx" ON "supplier_payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_payouts_period_idx" ON "supplier_payouts" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "supplier_products_supplier_id_idx" ON "supplier_products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_products_product_id_idx" ON "supplier_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "supplier_products_status_idx" ON "supplier_products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_shipment_items_shipment_id_idx" ON "supplier_shipment_items" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "supplier_shipment_items_product_id_idx" ON "supplier_shipment_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "supplier_shipments_shipment_number_idx" ON "supplier_shipments" USING btree ("shipment_number");--> statement-breakpoint
CREATE INDEX "supplier_shipments_supplier_id_idx" ON "supplier_shipments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_shipments_status_idx" ON "supplier_shipments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wms_case_labels_barcode_idx" ON "wms_case_labels" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "wms_case_labels_lwin18_idx" ON "wms_case_labels" USING btree ("lwin18");--> statement-breakpoint
CREATE INDEX "wms_case_labels_current_location_id_idx" ON "wms_case_labels" USING btree ("current_location_id");--> statement-breakpoint
CREATE INDEX "wms_cycle_counts_location_id_idx" ON "wms_cycle_counts" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "wms_cycle_counts_status_idx" ON "wms_cycle_counts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wms_delivery_notes_batch_id_idx" ON "wms_delivery_notes" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "wms_dispatch_batch_orders_batch_id_idx" ON "wms_dispatch_batch_orders" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "wms_dispatch_batch_orders_order_id_idx" ON "wms_dispatch_batch_orders" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "wms_dispatch_batches_status_idx" ON "wms_dispatch_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wms_dispatch_batches_distributor_id_idx" ON "wms_dispatch_batches" USING btree ("distributor_id");--> statement-breakpoint
CREATE INDEX "wms_locations_aisle_idx" ON "wms_locations" USING btree ("aisle");--> statement-breakpoint
CREATE INDEX "wms_locations_location_type_idx" ON "wms_locations" USING btree ("location_type");--> statement-breakpoint
CREATE INDEX "wms_locations_barcode_idx" ON "wms_locations" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "wms_pallet_cases_pallet_id_idx" ON "wms_pallet_cases" USING btree ("pallet_id");--> statement-breakpoint
CREATE INDEX "wms_pallet_cases_case_label_id_idx" ON "wms_pallet_cases" USING btree ("case_label_id");--> statement-breakpoint
CREATE INDEX "wms_pallets_owner_id_idx" ON "wms_pallets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "wms_pallets_location_id_idx" ON "wms_pallets" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "wms_pallets_status_idx" ON "wms_pallets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wms_pallets_barcode_idx" ON "wms_pallets" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "wms_partner_requests_partner_id_idx" ON "wms_partner_requests" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "wms_partner_requests_status_idx" ON "wms_partner_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wms_pick_list_items_pick_list_id_idx" ON "wms_pick_list_items" USING btree ("pick_list_id");--> statement-breakpoint
CREATE INDEX "wms_pick_lists_status_idx" ON "wms_pick_lists" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wms_pick_lists_order_id_idx" ON "wms_pick_lists" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "wms_repacks_location_id_idx" ON "wms_repacks" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "wms_repacks_owner_id_idx" ON "wms_repacks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "wms_stock_location_id_idx" ON "wms_stock" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "wms_stock_owner_id_idx" ON "wms_stock" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "wms_stock_lwin18_idx" ON "wms_stock" USING btree ("lwin18");--> statement-breakpoint
CREATE INDEX "wms_stock_shipment_id_idx" ON "wms_stock" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "wms_stock_movements_movement_type_idx" ON "wms_stock_movements" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "wms_stock_movements_lwin18_idx" ON "wms_stock_movements" USING btree ("lwin18");--> statement-breakpoint
CREATE INDEX "wms_stock_movements_performed_at_idx" ON "wms_stock_movements" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "wms_storage_charges_owner_id_idx" ON "wms_storage_charges" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "wms_storage_charges_pallet_id_idx" ON "wms_storage_charges" USING btree ("pallet_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_partner_id_idx" ON "notifications" USING btree ("partner_id");